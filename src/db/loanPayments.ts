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
 * Marks an installment paid: creates the linked transaction (expense if
 * borrowed, income if lent — money moving the opposite direction) and
 * updates the loan's outstanding principal.
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

  // The transaction insert lives inside the same withTransactionAsync block
  // as the loan_payments/loans updates (rather than going through the
  // higher-level createTransaction() beforehand) so a mid-write failure can
  // never leave an expense recorded with the loan's schedule left stale.
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
 * Records a rate change on a floating-rate loan. Real lenders offer the
 * borrower exactly this choice whenever the rate moves — reduce/increase
 * the EMI and keep paying off in the same number of months, or keep the
 * EMI exactly as-is and let the remaining tenure shrink/stretch instead:
 *
 * - `mode: 'keepEmi'` (the original, still the default) keeps the EMI fixed
 *   and regenerates the remaining schedule at the new rate — tenure
 *   lengthens (rate rose) or shortens (rate fell) instead. Same
 *   re-amortization approach `applyPrepayment` uses for a balance drop.
 * - `mode: 'keepTenure'` recomputes the EMI needed to still finish in
 *   exactly the same number of remaining installments at the new rate —
 *   the EMI itself drops (rate fell) or rises (rate rose) instead, and the
 *   payoff date never moves.
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
  // Anchored to the loan's own original due dates, not the date the rate
  // change was actually made — otherwise every future installment's due-day
  // silently shifts to whatever day of the month this happened to be done
  // on (e.g. a loan due on the 5th permanently moving to the 20th just
  // because that's when the rate was updated). See scheduleAnchor.
  const anchor = await scheduleAnchor(db, loanId, nextInstallmentNumber, opts.effectiveDate);

  // The EMI recalculateAfterPrepayment amortizes against — fixed (the old
  // EMI) in keepEmi mode, or freshly computed to close out in exactly the
  // remaining number of installments in keepTenure mode. Either way it's
  // then fed through the same schedule-regeneration path.
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
          // keepTenure promises the payoff date never moves — the EMI above
          // is rounded to the paisa, so without a hard last installment the
          // leftover rounding (often 1 paisa) spilled into a phantom extra
          // installment a month past that date. The last one absorbs it
          // instead, same as generateAmortizationSchedule's own final row.
          lastInstallmentNumber: mode === 'keepTenure' ? loan.tenure_months : undefined,
        })
      : [];

  // A rate high enough that the existing EMI no longer covers even the
  // interest accruing on the outstanding balance can never amortize —
  // recalculateAfterPrepayment defensively stops rather than looping
  // forever, which without this check would silently leave the loan
  // "active" with its full outstanding balance and zero future
  // installments: no error, no schedule, no way to ever pay it off again.
  // Only reachable in keepEmi mode — keepTenure always solves for an EMI
  // that covers the remaining term by construction.
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
    // Recorded so "when did this rate actually change" has a real answer
    // later — previously nothing kept the old rate or the date once
    // interest_rate_annual_bp was overwritten above.
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
 * Reverses payInstallment: deletes the linked transaction, puts the
 * installment back to 'pending', and restores the loan's outstanding
 * principal to what it was immediately before that payment. Only allowed on
 * the most recently paid installment for its loan — undoing an earlier one
 * while a later one is already paid would leave the schedule internally
 * inconsistent (the later installment's interest was already computed
 * against a lower outstanding balance than this undo would restore).
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
  // Exactly the balance this installment was amortized against — every
  // schedule row (original, or regenerated after a prepayment/rate change)
  // is built as `outstanding_after = balance − principal_component`. The
  // previous installment's own `outstanding_after` is NOT that balance once
  // a prepayment sits between the two: it predates the prepayment, so
  // restoring it put the prepaid amount back on the loan.
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
 * Applies a lump-sum prepayment: reduces outstanding principal immediately,
 * then regenerates the remaining schedule (keeping EMI fixed, tenure shrinks).
 *
 * `chargeAmountMinor` is an optional prepayment/foreclosure charge some
 * lenders levy — recorded as its own separate expense transaction (a fee,
 * never part of the principal repayment), so it debits the account without
 * ever reducing outstanding principal or feeding into the amortization
 * schedule. Per RBI's Pre-payment Charges on Loans Directions, floating-rate
 * loans to individual borrowers (non-business) cannot legally carry this
 * charge at all — Yume never assumes one; it's purely what the caller
 * (the UI) passes in, since only the user's actual loan agreement knows the
 * real number for a fixed-rate loan.
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
 * Everything a prepayment of `amountMinor` on `date` would do to this loan,
 * computed without writing anything: the new outstanding balance, the
 * regenerated schedule, and the before/after comparison. applyPrepayment
 * runs exactly this and then writes it; previewPrepayment runs exactly this
 * and stops — so the preview a user sees before confirming can never differ
 * from what confirming then records.
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
  // Anchored to the loan's own original due dates, not the date the
  // prepayment happened to be made — see the identical note in
  // applyRateChange. Without this, paying extra on the 20th of the month
  // permanently drags every future EMI's due-day from (say) the 5th to the
  // 20th, and can silently clear an "overdue" flag on the next installment.
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
    // Clamped defensively — the two schedules are computed differently
    // enough (fixed EMI/rounding drift) that a rare edge case could put the
    // new total a paisa above the old one; this is a "you saved" figure, it
    // should never read negative.
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
 * What a prepayment would save, before any money moves — read-only, the
 * same calculation applyPrepayment then records (see planPrepayment).
 * Returns null for an amount that couldn't be applied at all (not positive,
 * or more than is owed); `neverPaysOff` is the case applyPrepayment refuses.
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
  // The charge is an expense, so it needs an expense category. For a
  // borrowed loan `categoryId` already is one (Loan EMI) and stays the
  // charge's category exactly as before; for a lent loan it's the INCOME
  // category the repayment itself is filed under, which filed the charge
  // as an expense tagged "Loan Repayment".
  const chargeCategoryId =
    loan.direction === 'borrowed' || !opts.chargeAmountMinor ? opts.categoryId : await feeCategoryId(db);
  // The UI already blocks this, but this function has no other caller-side
  // guarantee — an over-prepayment would otherwise record a transaction for
  // more cash than the loan needed, with the excess never tracked anywhere.
  if (opts.amountMinor > loan.outstanding_principal_minor) {
    throw new Error('Prepayment cannot exceed the outstanding balance');
  }

  const { newOutstanding, newSchedule, summary, neverPaysOff } = await planPrepayment(
    db,
    loan,
    opts.amountMinor,
    opts.date
  );
  // Same guard `applyRateChange` already has: if the existing EMI can't
  // cover interest on what's left after this prepayment, recalculateAfterPrepayment
  // defensively stops early rather than looping forever — without this
  // check that silently leaves the loan "active" with a truncated schedule
  // and no future installments to ever close it.
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
      // A real fee, always a cash outflow from the account regardless of
      // loan direction (even lending your own money out and getting repaid
      // early doesn't waive a bank's charge on the account the repayment
      // passes through) — always 'expense', never touches the loan schedule.
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
