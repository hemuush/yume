import { found } from './found';
import { LoanRow } from './rows';
import { getDb } from './client';
import { newId } from '@/lib/id';
import { assertSpendableAccount } from './ledger';
import { Loan } from '@/types';
import { calculateEmi, generateAmortizationSchedule } from '@/lib/loan';
import { rebuildNotifications } from '@/lib/notifications';
import { captureRow, captureRows, restoreRows, RowSnapshot } from './undoSnapshot';

import { rowToLoan } from './loanRows';

/** Creating, editing and deleting loans (re-exported from ./loans). */

export interface CreateLoanInput {
  direction: Loan['direction'];
  counterparty: string;
  principalMinor: number;
  interestRateAnnualBp: number;
  tenureMonths: number;
  startDate: string;
  linkedAccountId?: string | null;
  rateType?: Loan['rateType'];
  personId?: string | null;
  notes?: string;
  /**
   * What this loan financed (e.g. "Home", "Car") and its current value —
   * only meaningful for a borrowed loan. Recording one offsets this loan's
   * own net-worth contribution with the asset's real equity instead of
   * counting pure debt with nothing behind it. Omit both for a loan with no
   * real-world asset (a personal loan, a credit card) — the original
   * "assets aren't tracked" behavior for anyone who doesn't set one.
   */
  assetLabel?: string | null;
  assetValueMinor?: number | null;
  /**
   * How many installments were already paid before you started tracking
   * this loan in Yume (0 for a brand-new loan). Those installments are
   * marked 'paid' with no linked transaction — the app never fabricates
   * historical cash movements it didn't witness — and the loan's starting
   * outstanding balance is taken from the schedule at that point, not the
   * original principal. Mutually exclusive with `disbursement`: a loan you
   * already owe money on was disbursed before you started using the app.
   */
  alreadyPaidInstallments?: number;
  /**
   * The date the first EMI is actually due — separate from `startDate`
   * (the disbursement/sanction date) because real lenders routinely leave a
   * gap between the two (money disbursed mid-month, first EMI due the 1st
   * of a later month). Only meaningful alongside `disbursement`; ignored
   * for an already-in-progress loan, where `startDate` already means "first
   * EMI period" with no separate disbursement to offset from. Defaults to
   * `startDate` itself if omitted, matching the old undifferentiated behavior.
   */
  emiStartDate?: string;
  /**
   * If this loan's cash is moving right now (a new loan being taken out or
   * money being lent this moment), records that disbursement as a real
   * transaction in the same account: income for a borrowed loan (cash
   * arrives), expense for a lent loan (cash leaves). Omit for a
   * pre-existing loan (alreadyPaidInstallments > 0) — the disbursement
   * already happened outside the app and fabricating it now would distort
   * the account's current balance.
   *
   * `feeAmountMinor` covers the processing/documentation/franking charges a
   * lender almost always deducts at disbursement — a real, separate cash
   * outflow that has nothing to do with the loan principal or its
   * amortization schedule (the schedule always runs on the full sanctioned
   * amount). Recorded as its own expense transaction, same date and
   * account, rather than netted invisibly against the disbursement, so it
   * shows up in Reports/Categories like the real charge it is. Needs its
   * own `feeCategoryId` — for a borrowed loan, `categoryId` above is an
   * INCOME category (matching the disbursement itself), which can't also
   * tag an expense.
   */
  disbursement?: {
    accountId: string;
    categoryId: string;
    feeAmountMinor?: number;
    feeCategoryId?: string;
  } | null;
}

/**
 * Creates the loan and its full amortization schedule (plus, optionally,
 * the disbursement transaction) in one atomic write. Without a recorded
 * disbursement, adding a loan changes no account balance — it only starts
 * tracking payments from here on, which is correct for a loan you already
 * had before using the app but would silently overstate/understate net
 * worth for a brand-new loan if `disbursement` were skipped there too.
 */
export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  if (
    !Number.isFinite(input.principalMinor) ||
    input.principalMinor <= 0 ||
    !Number.isFinite(input.interestRateAnnualBp) ||
    input.interestRateAnnualBp < 0 ||
    !Number.isFinite(input.tenureMonths) ||
    input.tenureMonths <= 0
  ) {
    throw new Error('Loan principal, interest rate, and tenure must be valid numbers');
  }
  const db = await getDb();
  const id = newId();
  const emi = calculateEmi(input.principalMinor, input.interestRateAnnualBp, input.tenureMonths);
  // A recorded disbursement can have its own date, distinct from when the
  // first EMI is actually due (see emiStartDate doc above) — an
  // already-in-progress loan has no disbursement to offset from, so its
  // single startDate always doubles as the schedule's own reference point.
  const scheduleStartDate = input.disbursement ? input.emiStartDate || input.startDate : input.startDate;
  const schedule = generateAmortizationSchedule({
    loanId: id,
    principalMinor: input.principalMinor,
    annualRateBp: input.interestRateAnnualBp,
    tenureMonths: input.tenureMonths,
    startDate: scheduleStartDate,
  });

  // Capped by the schedule's actual length, not tenureMonths — rounding can
  // make generateAmortizationSchedule close the loan out a installment or
  // two early (an "overshoot" closure absorbing residual paise), so a
  // tenureMonths-only cap could let `alreadyPaid` index past the real
  // schedule, silently falling back to the full original principal while
  // every generated installment still gets marked 'paid' below.
  const alreadyPaid = Math.max(0, Math.min(input.alreadyPaidInstallments ?? 0, schedule.length));
  const startingOutstanding =
    alreadyPaid > 0 && schedule[alreadyPaid - 1]
      ? schedule[alreadyPaid - 1].outstandingAfterMinor
      : input.principalMinor;
  const startingStatus = startingOutstanding === 0 ? 'closed' : 'active';

  const disbursementTxId = input.disbursement && alreadyPaid === 0 ? newId() : null;
  const feeAmountMinor = input.disbursement?.feeAmountMinor ?? 0;
  if (feeAmountMinor < 0 || !Number.isFinite(feeAmountMinor)) {
    throw new Error('Disbursement fee must be a valid, non-negative number');
  }
  if (
    input.assetValueMinor != null &&
    (!Number.isFinite(input.assetValueMinor) || input.assetValueMinor < 0)
  ) {
    throw new Error('Asset value must be a valid, non-negative number');
  }
  if (input.disbursement) {
    await assertSpendableAccount(
      input.direction === 'borrowed' ? 'income' : 'expense',
      input.disbursement.accountId
    );
    // The processing fee (if any) posts as its own 'expense' row on this same
    // account regardless of direction — check that separately since a
    // borrowed loan's disbursement itself is 'income' and wouldn't catch it.
    if (feeAmountMinor > 0) {
      await assertSpendableAccount('expense', input.disbursement.accountId);
    }
  }

  await db.withTransactionAsync(async (tx) => {
    // The loan row is inserted before its disbursement/fee transactions —
    // those now carry a loan_id FK back to this row (ON DELETE CASCADE), so
    // the loan must already exist or the insert would violate that
    // constraint.
    await tx.runAsync(
      `INSERT INTO loans
        (id, direction, counterparty, principal_minor, interest_rate_annual_bp, tenure_months,
         start_date, emi_amount_minor, outstanding_principal_minor, status, linked_account_id,
         rate_type, person_id, notes, asset_label, asset_value_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.direction,
        input.counterparty,
        input.principalMinor,
        input.interestRateAnnualBp,
        input.tenureMonths,
        input.startDate,
        emi,
        startingOutstanding,
        startingStatus,
        input.disbursement?.accountId ?? input.linkedAccountId ?? null,
        input.rateType ?? 'fixed',
        input.personId ?? null,
        input.notes ?? '',
        input.assetLabel ?? null,
        input.assetValueMinor ?? null,
      ]
    );

    if (disbursementTxId && input.disbursement) {
      await tx.runAsync(
        `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id, loan_tx_kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'disbursement')`,
        [
          disbursementTxId,
          input.direction === 'borrowed' ? 'income' : 'expense',
          input.disbursement.accountId,
          input.disbursement.categoryId,
          input.principalMinor,
          input.startDate,
          `Loan disbursement — ${input.counterparty}`,
          id,
        ]
      );
      if (feeAmountMinor > 0) {
        // Always an expense regardless of loan direction — deducted by the
        // lender (borrowed) or paid to formalize lending your own money out
        // (lent), either way real cash left the account through processing/
        // documentation charges, separate from the principal itself.
        await tx.runAsync(
          `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id, loan_tx_kind)
           VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, 'fee')`,
          [
            newId(),
            input.disbursement.accountId,
            // For a lent loan, categoryId is already an expense category
            // (the disbursement itself is an expense) and doubles as the
            // fee's category too; for a borrowed loan it's an income
            // category and the caller must supply feeCategoryId instead.
            input.disbursement.feeCategoryId ?? input.disbursement.categoryId,
            feeAmountMinor,
            input.startDate,
            `Loan processing fee — ${input.counterparty}`,
            id,
          ]
        );
      }
    }

    for (let idx = 0; idx < schedule.length; idx++) {
      const inst = schedule[idx];
      const isAlreadyPaid = idx < alreadyPaid;
      await tx.runAsync(
        `INSERT INTO loan_payments
          (id, loan_id, installment_number, due_date, emi_amount_minor,
           principal_component_minor, interest_component_minor, outstanding_after_minor, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inst.id,
          inst.loanId,
          inst.installmentNumber,
          inst.dueDate,
          inst.emiAmountMinor,
          inst.principalComponentMinor,
          inst.interestComponentMinor,
          inst.outstandingAfterMinor,
          isAlreadyPaid ? 'paid' : 'pending',
        ]
      );
    }
  });

  await rebuildNotifications();
  const row = await db.getFirstAsync<LoanRow>('SELECT * FROM loans WHERE id = ?', [id]);
  return rowToLoan(found(row, 'loan'));
}

/**
 * Removes a loan entirely — for fixing a mis-entered loan (e.g. a start
 * date and "already paid" count that don't agree with each other), not for
 * a loan that's simply paid off (that's `status: 'closed'`, still worth
 * keeping for history). Blocked whenever any installment has a real linked
 * transaction, or a prepayment was ever made — undo the real payment first
 * rather than silently deleting a loan out from under money that already
 * moved. (Prepayment currently has no undo path — a loan with one can't be
 * deleted at all yet, a known, honest limitation rather than the alternative
 * of quietly erasing the record of real cash that moved.)
 *
 * `loan_payments` rows cascade-delete with the loan (schema's own ON DELETE
 * CASCADE), and so do the loan's own disbursement/processing-fee
 * transactions (via transactions.loan_id, also ON DELETE CASCADE) — those
 * were created by, and only make sense alongside, this same loan entry, so
 * removing a mis-entered loan now takes them with it instead of leaving
 * them behind as orphaned "Loan disbursement" rows with nothing to point to.
 */
export async function deleteLoan(loanId: string): Promise<RowSnapshot[]> {
  const db = await getDb();
  const linkedPayment = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM loan_payments WHERE loan_id = ? AND transaction_id IS NOT NULL LIMIT 1`,
    [loanId]
  );
  if (linkedPayment) {
    throw new Error('This loan has real recorded payments — undo those first before deleting it.');
  }
  const prepayment = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM transactions WHERE loan_id = ? AND loan_tx_kind IN ('prepayment', 'prepayment_charge') LIMIT 1`,
    [loanId]
  );
  if (prepayment) {
    throw new Error(
      "This loan has a recorded prepayment, which can't be undone yet — it can't be deleted while that exists."
    );
  }
  // The loan row goes first: `loan_payments`, `loan_rate_changes`, and the
  // loan's own disbursement/fee `transactions` all foreign-key back to it
  // (each `ON DELETE CASCADE`), so restoring in this same order gives every
  // child row its parent before it needs it.
  // Four independent SELECTs against separate tables — Promise.all still
  // returns them in this same order regardless of which resolves first, so
  // parallelizing doesn't disturb the parent-before-children restore order
  // below, just avoids paying each query's latency back to back.
  const [loanSnapshot, payments, rateChanges, linkedTransactions] = await Promise.all([
    captureRow(db, 'loans', loanId),
    captureRows(db, 'loan_payments', 'loan_id = ?', [loanId]),
    captureRows(db, 'loan_rate_changes', 'loan_id = ?', [loanId]),
    captureRows(db, 'transactions', 'loan_id = ?', [loanId]),
  ]);
  const cascaded = [...payments, ...rateChanges, ...linkedTransactions];
  await db.runAsync('DELETE FROM loans WHERE id = ?', [loanId]);
  await rebuildNotifications();
  return loanSnapshot ? [loanSnapshot, ...cascaded] : cascaded;
}

/** Undoes `deleteLoan` — re-inserts the loan and everything that cascaded away with it, then rebuilds the notifications. */
export async function restoreLoan(snapshots: RowSnapshot[]): Promise<void> {
  const db = await getDb();
  await restoreRows(db, snapshots);
  const loanId = snapshots.find((s) => s.table === 'loans')?.row.id;
  await rebuildNotifications();
}

/**
 * Sets or updates the tracked value of whatever a loan financed (a home, a
 * vehicle) — separate from `createLoan` since a property's value is worth
 * revisiting occasionally (an appraisal, a market check), not just set once
 * at creation and forgotten. Pass `null` for both to stop tracking one.
 */
export async function updateLoanAsset(
  loanId: string,
  input: { assetLabel: string | null; assetValueMinor: number | null }
): Promise<void> {
  if (
    input.assetValueMinor != null &&
    (!Number.isFinite(input.assetValueMinor) || input.assetValueMinor < 0)
  ) {
    throw new Error('Asset value must be a valid, non-negative number');
  }
  const db = await getDb();
  await db.runAsync('UPDATE loans SET asset_label = ?, asset_value_minor = ? WHERE id = ?', [
    input.assetLabel,
    input.assetValueMinor,
    loanId,
  ]);
}

/**
 * Changes which account this loan's future EMIs default to. Only affects
 * payments made from here on — it never touches transactions already
 * recorded against the old account, matching how re-parenting a category or
 * changing a loan's rate never rewrites history either.
 */
export async function updateLoanAccount(loanId: string, accountId: string): Promise<void> {
  const db = await getDb();
  const account = await db.getFirstAsync<{ id: string }>('SELECT id FROM accounts WHERE id = ?', [accountId]);
  if (!account) throw new Error('Account not found');
  await db.runAsync('UPDATE loans SET linked_account_id = ? WHERE id = ?', [accountId, loanId]);
}
