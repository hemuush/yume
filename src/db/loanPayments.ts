import { LoanPaymentRow, LoanRow } from './rows';
import { getDb } from './client';
import { newId } from '@/lib/id';
import { assertSpendableAccount } from './ledger';
import { calculateEmi, recalculateAfterPrepayment } from '@/lib/loan';
import { formatMoney } from '@/lib/money';

import { scheduleAnchor, feeCategoryId } from './loanRows';
import { rebuildNotifications } from '@/lib/notifications';

/** Paying EMIs, rate changes and prepayments (re-exported from ./loans). */

/**
 * Marks an installment paid: creates the linked transaction (expense if borrowed, income if lent)
 * and reduces the loan's outstanding principal.
 */
export async function payInstallment(
  loanPaymentId: string,
  opts: { accountId: string; categoryId: string; paidDate: string }
): Promise<void> {
  const db = await getDb();
  const payment = await db.getFirstAsync<LoanPaymentRow>('SELECT * FROM loan_payments WHERE id = ?', [
    loanPaymentId,
  ]);
  if (!payment) throw new Error('Loan payment not found');
  if (payment.status === 'paid') throw new Error('This installment has already been paid');
  const loan = await db.getFirstAsync<LoanRow>('SELECT * FROM loans WHERE id = ?', [payment.loan_id]);
  if (!loan) throw new Error('Loan not found');
  await assertSpendableAccount(loan.direction === 'borrowed' ? 'expense' : 'income', opts.accountId);

  // Insert inside the same withTransactionAsync as the loan updates (not via createTransaction) so a
  // mid-write failure can't leave an expense recorded against a stale schedule.
  const txId = newId();
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        loan.direction === 'borrowed' ? 'expense' : 'income',
        opts.accountId,
        opts.categoryId,
        payment.emi_amount_minor,
        opts.paidDate,
        `EMI #${payment.installment_number} — ${loan.counterparty}`,
      ]
    );
    await tx.runAsync(
      `UPDATE loan_payments SET status = 'paid', paid_date = ?, transaction_id = ? WHERE id = ?`,
      [opts.paidDate, txId, loanPaymentId]
    );
    await tx.runAsync(`UPDATE loans SET outstanding_principal_minor = ? WHERE id = ?`, [
      payment.outstanding_after_minor,
      payment.loan_id,
    ]);
    if (payment.outstanding_after_minor === 0) {
      await tx.runAsync(`UPDATE loans SET status = 'closed' WHERE id = ?`, [payment.loan_id]);
    }
  });
  await rebuildNotifications();
}

/**
 * Records a floating-rate change. `keepEmi` (default): EMI fixed, schedule regenerated, tenure shifts.
 * `keepTenure`: EMI recomputed to finish in the same remaining installments, payoff date never moves.
 */
export async function applyRateChange(
  loanId: string,
  opts: { newAnnualRateBp: number; effectiveDate: string; mode?: 'keepEmi' | 'keepTenure' }
): Promise<void> {
  if (!Number.isFinite(opts.newAnnualRateBp) || opts.newAnnualRateBp < 0) {
    throw new Error('New interest rate must be a valid, non-negative number');
  }
  if (!opts.effectiveDate) {
    throw new Error('Enter the date this rate change actually took effect');
  }
  const mode = opts.mode ?? 'keepEmi';
  const db = await getDb();
  const loan = await db.getFirstAsync<LoanRow>('SELECT * FROM loans WHERE id = ?', [loanId]);
  if (!loan) throw new Error('Loan not found');
  if (loan.rate_type !== 'floating') {
    throw new Error('Only floating-rate loans can have their rate updated');
  }
  if (opts.effectiveDate < loan.start_date) {
    throw new Error("The effective date can't be before the loan itself started.");
  }

  const paidInstallments = await db.getAllAsync<LoanPaymentRow>(
    `SELECT * FROM loan_payments WHERE loan_id = ? AND status = 'paid' ORDER BY installment_number DESC LIMIT 1`,
    [loanId]
  );
  const nextInstallmentNumber = paidInstallments.length ? paidInstallments[0].installment_number + 1 : 1;
  // Anchored to the loan's original due dates, not the date of this change, so future due-days
  // don't drift to whatever day the rate was updated. See scheduleAnchor.
  const anchor = await scheduleAnchor(db, loanId, nextInstallmentNumber, opts.effectiveDate);

  // The EMI to amortize against: the old EMI in keepEmi mode, or one solved to close out in exactly the
  // remaining installments in keepTenure mode.
  const remainingMonths = loan.tenure_months - (nextInstallmentNumber - 1);
  if (mode === 'keepTenure' && remainingMonths <= 0) {
    throw new Error('This loan has no remaining installments to recalculate a tenure-preserving EMI over.');
  }
  const emiForSchedule =
    mode === 'keepTenure'
      ? calculateEmi(loan.outstanding_principal_minor, opts.newAnnualRateBp, remainingMonths)
      : loan.emi_amount_minor;

  const newSchedule =
    loan.outstanding_principal_minor > 0
      ? recalculateAfterPrepayment({
          loanId,
          outstandingPrincipalMinor: loan.outstanding_principal_minor,
          annualRateBp: opts.newAnnualRateBp,
          emiAmountMinor: emiForSchedule,
          fromInstallmentNumber: nextInstallmentNumber,
          fromDate: anchor.fromDate,
          anchorInstallmentNumber: anchor.anchorInstallmentNumber,
          // keepTenure promises a fixed payoff date: the EMI is paisa-rounded, so the last installment
          // absorbs the leftover rounding instead of spilling into a phantom extra one.
          lastInstallmentNumber: mode === 'keepTenure' ? loan.tenure_months : undefined,
        })
      : [];

  // An EMI below accruing interest can never amortize; recalculateAfterPrepayment stops silently,
  // leaving the loan active with no schedule. Only reachable in keepEmi (keepTenure solves for the EMI).
  const stillOwesAfterSchedule = newSchedule.length
    ? newSchedule[newSchedule.length - 1].outstandingAfterMinor
    : loan.outstanding_principal_minor;
  if (mode === 'keepEmi' && stillOwesAfterSchedule > 0) {
    throw new Error(
      `At ${(opts.newAnnualRateBp / 100).toFixed(2)}% p.a., the current EMI of ${formatMoney(loan.emi_amount_minor)} doesn't even cover the monthly interest — this loan would never pay off. Increase the EMI (via a new loan entry) or choose a lower rate.`
    );
  }

  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync(`DELETE FROM loan_payments WHERE loan_id = ? AND status = 'pending'`, [loanId]);
    for (const inst of newSchedule) {
      await tx.runAsync(
        `INSERT INTO loan_payments
          (id, loan_id, installment_number, due_date, emi_amount_minor,
           principal_component_minor, interest_component_minor, outstanding_after_minor, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          inst.id,
          inst.loanId,
          inst.installmentNumber,
          inst.dueDate,
          inst.emiAmountMinor,
          inst.principalComponentMinor,
          inst.interestComponentMinor,
          inst.outstandingAfterMinor,
        ]
      );
    }
    const newEmiAmount = mode === 'keepTenure' ? emiForSchedule : loan.emi_amount_minor;
    await tx.runAsync(`UPDATE loans SET interest_rate_annual_bp = ?, emi_amount_minor = ? WHERE id = ?`, [
      opts.newAnnualRateBp,
      newEmiAmount,
      loanId,
    ]);
    // Kept so the old rate and change date survive interest_rate_annual_bp being overwritten above.
    await tx.runAsync(
      `INSERT INTO loan_rate_changes
        (id, loan_id, old_rate_annual_bp, new_rate_annual_bp, effective_date, mode, old_emi_amount_minor, new_emi_amount_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        loanId,
        loan.interest_rate_annual_bp,
        opts.newAnnualRateBp,
        opts.effectiveDate,
        mode,
        loan.emi_amount_minor,
        newEmiAmount,
      ]
    );
  });
  await rebuildNotifications();
}

/**
 * Reverses payInstallment: deletes its transaction, sets it back to 'pending', restores principal. Only the
 * latest paid installment may be undone, since later interest was computed on a lower balance.
 */
export async function undoInstallmentPayment(loanPaymentId: string): Promise<void> {
  const db = await getDb();
  const payment = await db.getFirstAsync<LoanPaymentRow>('SELECT * FROM loan_payments WHERE id = ?', [
    loanPaymentId,
  ]);
  if (!payment) throw new Error('Loan payment not found');
  if (payment.status !== 'paid') throw new Error('This installment has not been paid');

  const laterPaid = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM loan_payments WHERE loan_id = ? AND status = 'paid' AND installment_number > ?`,
    [payment.loan_id, payment.installment_number]
  );
  if (laterPaid) {
    throw new Error(
      "Undo the most recently paid installment first — earlier ones can't be undone out of order."
    );
  }

  const loan = await db.getFirstAsync<{ id: string }>('SELECT id FROM loans WHERE id = ?', [payment.loan_id]);
  if (!loan) throw new Error('Loan not found');
  // Restore the balance this installment was amortized against (`outstanding_after = balance − principal`).
  // The previous row's outstanding_after is wrong once a prepayment sits between: it predates it.
  const restoredOutstanding = payment.outstanding_after_minor + payment.principal_component_minor;

  await db.withTransactionAsync(async (tx) => {
    if (payment.transaction_id) {
      await tx.runAsync('DELETE FROM transactions WHERE id = ?', [payment.transaction_id]);
    }
    await tx.runAsync(
      `UPDATE loan_payments SET status = 'pending', paid_date = NULL, transaction_id = NULL WHERE id = ?`,
      [loanPaymentId]
    );
    await tx.runAsync(`UPDATE loans SET outstanding_principal_minor = ?, status = 'active' WHERE id = ?`, [
      restoredOutstanding,
      payment.loan_id,
    ]);
  });
  await rebuildNotifications();
}

/**
 * Applies a lump-sum prepayment: cuts principal, regenerates the schedule (EMI fixed, tenure shrinks).
 * `chargeAmountMinor`: caller-supplied fee (RBI bars it on floating loans), a separate expense, not principal.
 */
export interface PrepaymentSummary {
  interestSavedMinor: number;
  /** Remaining installments shaved off — `oldRemainingCount - newRemainingCount`. */
  monthsShaved: number;
  /** Installments still pending before this prepayment was applied. */
  oldRemainingCount: number;
  /** Installments still pending after — 0 means this prepayment closed the loan outright. */
  newRemainingCount: number;
  oldPayoffDate: string;
  newPayoffDate: string;
}

/**
 * Everything a prepayment would do, computed without writing: new balance, regenerated schedule, comparison.
 * applyPrepayment writes this exact plan, so the preview can never differ from the result.
 */
async function planPrepayment(
  db: Awaited<ReturnType<typeof getDb>>,
  loan: {
    id: string;
    outstanding_principal_minor: number;
    interest_rate_annual_bp: number;
    emi_amount_minor: number;
  },
  amountMinor: number,
  date: string
): Promise<{
  newOutstanding: number;
  newSchedule: ReturnType<typeof recalculateAfterPrepayment>;
  summary: PrepaymentSummary;
  /** The existing EMI can't cover the interest on what's left — the loan would never close. */
  neverPaysOff: boolean;
}> {
  const loanId = loan.id;
  const paidInstallments = await db.getAllAsync<LoanPaymentRow>(
    `SELECT * FROM loan_payments WHERE loan_id = ? AND status = 'paid' ORDER BY installment_number DESC LIMIT 1`,
    [loanId]
  );
  const nextInstallmentNumber = paidInstallments.length ? paidInstallments[0].installment_number + 1 : 1;
  // Anchored to the original due dates, not the prepayment date (see applyRateChange), or paying extra
  // on the 20th drags every future due-day there and can clear the next "overdue" flag.
  const anchor = await scheduleAnchor(db, loanId, nextInstallmentNumber, date);

  // The "before" half of the interest-saved/months-shaved comparison — read
  // before any pending rows are replaced.
  const oldPending = await db.getAllAsync<{ interest_component_minor: number; due_date: string }>(
    `SELECT interest_component_minor, due_date FROM loan_payments WHERE loan_id = ? AND status = 'pending' ORDER BY installment_number ASC`,
    [loanId]
  );

  const newOutstanding = Math.max(0, loan.outstanding_principal_minor - amountMinor);

  const newSchedule =
    newOutstanding > 0
      ? recalculateAfterPrepayment({
          loanId,
          outstandingPrincipalMinor: newOutstanding,
          annualRateBp: loan.interest_rate_annual_bp,
          emiAmountMinor: loan.emi_amount_minor,
          fromInstallmentNumber: nextInstallmentNumber,
          fromDate: anchor.fromDate,
          anchorInstallmentNumber: anchor.anchorInstallmentNumber,
        })
      : [];

  const stillOwesAfterSchedule = newSchedule.length
    ? newSchedule[newSchedule.length - 1].outstandingAfterMinor
    : newOutstanding;

  const oldTotalInterestMinor = oldPending.reduce((sum, p) => sum + p.interest_component_minor, 0);
  const newTotalInterestMinor = newSchedule.reduce((sum, p) => sum + p.interestComponentMinor, 0);
  const summary: PrepaymentSummary = {
    // Clamped: the two schedules differ enough (EMI rounding drift) that the new total could exceed the old
    // by a paisa; a "you saved" figure must never read negative.
    interestSavedMinor: Math.max(0, oldTotalInterestMinor - newTotalInterestMinor),
    monthsShaved: Math.max(0, oldPending.length - newSchedule.length),
    oldRemainingCount: oldPending.length,
    newRemainingCount: newSchedule.length,
    oldPayoffDate: oldPending.length ? oldPending[oldPending.length - 1].due_date : date,
    newPayoffDate: newSchedule.length ? newSchedule[newSchedule.length - 1].dueDate : date,
  };
  return { newOutstanding, newSchedule, summary, neverPaysOff: stillOwesAfterSchedule > 0 };
}

/**
 * What a prepayment would save, read-only (same plan as applyPrepayment). Null if the amount can't apply
 * (not positive or more than owed); `neverPaysOff` is the case applyPrepayment refuses.
 */
export async function previewPrepayment(
  loanId: string,
  amountMinor: number,
  date: string
): Promise<(PrepaymentSummary & { neverPaysOff: boolean }) | null> {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return null;
  const db = await getDb();
  const loan = await db.getFirstAsync<LoanRow>('SELECT * FROM loans WHERE id = ?', [loanId]);
  if (!loan || amountMinor > loan.outstanding_principal_minor) return null;
  const { summary, neverPaysOff } = await planPrepayment(db, loan, amountMinor, date);
  return { ...summary, neverPaysOff };
}

export async function applyPrepayment(
  loanId: string,
  opts: {
    amountMinor: number;
    accountId: string;
    categoryId: string;
    date: string;
    chargeAmountMinor?: number;
  }
): Promise<PrepaymentSummary> {
  if (!Number.isFinite(opts.amountMinor) || opts.amountMinor <= 0) {
    throw new Error('Prepayment amount must be a valid positive number');
  }
  if (
    opts.chargeAmountMinor != null &&
    (!Number.isFinite(opts.chargeAmountMinor) || opts.chargeAmountMinor < 0)
  ) {
    throw new Error('Prepayment charge must be a valid, non-negative number');
  }
  const db = await getDb();
  const loan = await db.getFirstAsync<LoanRow>('SELECT * FROM loans WHERE id = ?', [loanId]);
  if (!loan) throw new Error('Loan not found');
  await assertSpendableAccount(loan.direction === 'borrowed' ? 'expense' : 'income', opts.accountId);
  if (opts.chargeAmountMinor) {
    // Always posts as its own 'expense' row regardless of direction — see
    // the identical note above the insert below.
    await assertSpendableAccount('expense', opts.accountId);
  }
  // The charge is an expense, so it needs an expense category: a borrowed loan's categoryId already is one
  // (Loan EMI); a lent loan's is INCOME, so it uses the fee category instead.
  const chargeCategoryId =
    loan.direction === 'borrowed' || !opts.chargeAmountMinor ? opts.categoryId : await feeCategoryId(db);
  // The UI already blocks this, but nothing else guards it: an over-prepayment would record more cash than
  // the loan needed, with the excess untracked.
  if (opts.amountMinor > loan.outstanding_principal_minor) {
    throw new Error('Prepayment cannot exceed the outstanding balance');
  }

  const { newOutstanding, newSchedule, summary, neverPaysOff } = await planPrepayment(
    db,
    loan,
    opts.amountMinor,
    opts.date
  );
  // Same guard as applyRateChange: if the EMI can't cover interest after this prepayment the schedule is
  // silently truncated, leaving the loan active with no installments to close it.
  if (neverPaysOff) {
    throw new Error(
      `The current EMI of ${formatMoney(loan.emi_amount_minor)} doesn't cover the interest on the remaining balance after this prepayment — this loan would never pay off. Try a larger prepayment amount.`
    );
  }

  const txId = newId();
  const chargeAmountMinor = opts.chargeAmountMinor ?? 0;
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id, loan_tx_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepayment')`,
      [
        txId,
        loan.direction === 'borrowed' ? 'expense' : 'income',
        opts.accountId,
        opts.categoryId,
        opts.amountMinor,
        opts.date,
        `Prepayment — ${loan.counterparty}`,
        loanId,
      ]
    );
    if (chargeAmountMinor > 0) {
      // A real fee is always a cash outflow from the account whatever the loan direction: always 'expense',
      // never touches the loan schedule.
      await tx.runAsync(
        `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id, loan_tx_kind)
         VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, 'prepayment_charge')`,
        [
          newId(),
          opts.accountId,
          chargeCategoryId,
          chargeAmountMinor,
          opts.date,
          `Prepayment charge — ${loan.counterparty}`,
          loanId,
        ]
      );
    }
    await tx.runAsync(`DELETE FROM loan_payments WHERE loan_id = ? AND status = 'pending'`, [loanId]);
    for (const inst of newSchedule) {
      await tx.runAsync(
        `INSERT INTO loan_payments
          (id, loan_id, installment_number, due_date, emi_amount_minor,
           principal_component_minor, interest_component_minor, outstanding_after_minor, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          inst.id,
          inst.loanId,
          inst.installmentNumber,
          inst.dueDate,
          inst.emiAmountMinor,
          inst.principalComponentMinor,
          inst.interestComponentMinor,
          inst.outstandingAfterMinor,
        ]
      );
    }
    await tx.runAsync(`UPDATE loans SET outstanding_principal_minor = ? WHERE id = ?`, [
      newOutstanding,
      loanId,
    ]);
    if (newOutstanding === 0) {
      await tx.runAsync(`UPDATE loans SET status = 'closed' WHERE id = ?`, [loanId]);
    }
  });
  await rebuildNotifications();

  return summary;
}
