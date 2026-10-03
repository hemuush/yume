import { LoanPaymentRow, LoanRow } from './rows';
import { getDb } from './client';
import { Loan, LoanPayment } from '@/types';

/** Shared by the loan modules: row mappers and the loan query. Not part of the public loans API. */

/**
 * Anchor for regenerated due dates: installment #1's date (never day-clamped; next pending is the fallback).
 * The next pending one could inherit a clamped day (Feb 28) and the action date would drift every due-day.
 */
export async function scheduleAnchor(
  db: Awaited<ReturnType<typeof getDb>>,
  loanId: string,
  nextInstallmentNumber: number,
  fallbackDate: string
): Promise<{ fromDate: string; anchorInstallmentNumber: number }> {
  const first = await db.getFirstAsync<{ due_date: string }>(
    'SELECT due_date FROM loan_payments WHERE loan_id = ? AND installment_number = 1',
    [loanId]
  );
  if (first) return { fromDate: first.due_date, anchorInstallmentNumber: 1 };
  const nextPending = await db.getFirstAsync<{ due_date: string }>(
    'SELECT due_date FROM loan_payments WHERE loan_id = ? AND installment_number = ?',
    [loanId, nextInstallmentNumber]
  );
  return { fromDate: nextPending?.due_date ?? fallbackDate, anchorInstallmentNumber: nextInstallmentNumber };
}

/**
 * Expense category for a lent loan's prepayment charge: system "Fees & Charges" (can't be renamed or
 * deleted), else the first active expense category.
 */
export async function feeCategoryId(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  const row =
    (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM categories WHERE is_system = 1 AND kind = 'expense' AND name = 'Fees & Charges' LIMIT 1`
    )) ??
    (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM categories WHERE kind = 'expense' AND archived = 0 ORDER BY sort_order ASC LIMIT 1`
    ));
  if (!row) throw new Error('No expense category available to file the prepayment charge under.');
  return row.id;
}

export function rowToLoan(row: LoanRow & { next_due_date?: string | null }): Loan {
  return {
    id: row.id,
    direction: row.direction,
    counterparty: row.counterparty,
    principalMinor: row.principal_minor,
    interestRateAnnualBp: row.interest_rate_annual_bp,
    tenureMonths: row.tenure_months,
    startDate: row.start_date,
    emiAmountMinor: row.emi_amount_minor,
    outstandingPrincipalMinor: row.outstanding_principal_minor,
    status: row.status,
    linkedAccountId: row.linked_account_id,
    rateType: row.rate_type ?? 'fixed',
    personId: row.person_id ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    nextDueDate: row.next_due_date ?? null,
    assetLabel: row.asset_label ?? null,
    assetValueMinor: row.asset_value_minor ?? null,
  };
}

// Shared by every query returning full Loan rows: joins the earliest pending installment's due date
// so the list screen shows "Next due" without a round-trip per loan.
export const LOAN_SELECT = `
  SELECT l.*,
    (SELECT due_date FROM loan_payments WHERE loan_id = l.id AND status = 'pending'
     ORDER BY installment_number ASC LIMIT 1) AS next_due_date
  FROM loans l`;

export function rowToLoanPayment(row: LoanPaymentRow): LoanPayment {
  return {
    id: row.id,
    loanId: row.loan_id,
    transactionId: row.transaction_id,
    installmentNumber: row.installment_number,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    emiAmountMinor: row.emi_amount_minor,
    principalComponentMinor: row.principal_component_minor,
    interestComponentMinor: row.interest_component_minor,
    outstandingAfterMinor: row.outstanding_after_minor,
    status: row.status,
  };
}
