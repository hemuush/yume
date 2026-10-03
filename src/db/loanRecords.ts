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
   * What this loan financed (e.g. "Home") and its value; borrowed loans only. Offsets the loan's net-worth
   * debt with the asset's equity. Omit both when there is no asset (personal loan, credit card).
   */
  assetLabel?: string | null;
  assetValueMinor?: number | null;
  /**
   * Installments paid before tracking began (0 if new): marked 'paid' with no transaction (no fabricated
   * history); starting balance comes from the schedule. Mutually exclusive with `disbursement`.
   */
  alreadyPaidInstallments?: number;
  /**
   * Date the first EMI is due, if later than `startDate` (the disbursement date). Only used alongside
   * `disbursement` (in-progress loans use `startDate`); defaults to `startDate`.
   */
  emiStartDate?: string;
  /**
   * Disbursement txn (income if borrowed, expense if lent) for a loan starting now; omit for existing loans.
   * `feeAmountMinor`: own expense row needing `feeCategoryId`; the schedule still uses the full amount.
   */
  disbursement?: {
    accountId: string;
    categoryId: string;
    feeAmountMinor?: number;
    feeCategoryId?: string;
  } | null;
}

/**
 * Creates the loan, its full amortization schedule and optionally the disbursement transaction atomically.
 * Without `disbursement` no balance changes: right for an existing loan, wrong for a brand-new one.
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
  // A disbursement has its own date, distinct from the first EMI due date (emiStartDate); an in-progress loan
  // has none, so its startDate doubles as the schedule's reference point.
  const scheduleStartDate = input.disbursement ? input.emiStartDate || input.startDate : input.startDate;
  const schedule = generateAmortizationSchedule({
    loanId: id,
    principalMinor: input.principalMinor,
    annualRateBp: input.interestRateAnnualBp,
    tenureMonths: input.tenureMonths,
    startDate: scheduleStartDate,
  });

  // Capped by the schedule's actual length, not tenureMonths: rounding can close the loan early, and a
  // tenureMonths cap would index past it and silently fall back to the full principal.
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
    // The fee posts as its own 'expense' row on this account regardless of direction; check it separately,
    // since a borrowed loan's disbursement is 'income' and wouldn't catch it.
    if (feeAmountMinor > 0) {
      await assertSpendableAccount('expense', input.disbursement.accountId);
    }
  }

  await db.withTransactionAsync(async (tx) => {
    // Insert the loan row before its disbursement/fee transactions, which FK back to it via loan_id.
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
        // Always an expense, whatever the direction: real cash left via processing/documentation charges,
        // separate from principal.
        await tx.runAsync(
          `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id, loan_tx_kind)
           VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, 'fee')`,
          [
            newId(),
            input.disbursement.accountId,
            // Lent loan: categoryId is already an expense category and doubles as the fee's. Borrowed: it's
            // income, so the caller must supply feeCategoryId.
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
 * Deletes a mis-entered loan (paid-off ones use `status: 'closed'`). Blocked if an installment has a real
 * transaction or a prepayment exists (no undo yet); its payments, disbursement and fee transactions cascade.
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
  // Loan row first: loan_payments, loan_rate_changes and its transactions FK to it (ON DELETE CASCADE).
  // The four SELECTs run in parallel; Promise.all keeps their order, so parent-before-children restore holds.
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
  await rebuildNotifications();
}

/**
 * Sets or updates the tracked value of what a loan financed (home, vehicle); separate from `createLoan`
 * since it's revisited over time. Pass `null` for both to stop tracking.
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
 * Changes the account future EMIs default to. Only affects payments from here on; transactions already
 * recorded against the old account are never rewritten.
 */
export async function updateLoanAccount(loanId: string, accountId: string): Promise<void> {
  const db = await getDb();
  const account = await db.getFirstAsync<{ id: string }>('SELECT id FROM accounts WHERE id = ?', [accountId]);
  if (!account) throw new Error('Account not found');
  await db.runAsync('UPDATE loans SET linked_account_id = ? WHERE id = ?', [accountId, loanId]);
}
