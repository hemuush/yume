import { LoanPaymentRow, LoanRow } from './rows';
import { getDb } from './client';
import { Loan, LoanPayment } from '@/types';
import { scheduleLoanDueReminder, cancelLoanDueReminder } from '@/lib/notifications';

/** Shared by the loan modules: row mappers, the loan query, and the due-reminder sync. Not part of the public loans API. */

/** Schedules a reminder for the loan's next pending installment, or cancels any reminder if none remains. */
export async function syncDueReminder(loanId: string): Promise<void> {
  const db = await getDb();
  const [loan, next] = await Promise.all([
    db.getFirstAsync<LoanRow>('SELECT * FROM loans WHERE id = ?', [loanId]),
    db.getFirstAsync<LoanPaymentRow>(
      `SELECT * FROM loan_payments WHERE loan_id = ? AND status = 'pending' ORDER BY installment_number ASC LIMIT 1`,
      [loanId]
    ),
  ]);
  if (!loan || !next || loan.direction !== 'borrowed' || loan.status !== 'active') {
    await cancelLoanDueReminder(loanId);
    return;
  }
  await scheduleLoanDueReminder(loanId, next.due_date, loan.counterparty, next.emi_amount_minor);
}

/**
 * Where a regenerated schedule (prepayment, rate change) counts its due
 * dates from: installment #1's own due date, the same anchor
 * generateAmortizationSchedule used when the loan was created. Anchoring to
 * the next *pending* installment instead would inherit a clamped day (a
 * 31st-of-the-month loan's Feb 28 installment) and every regenerated date
 * after it would stay on the 28th; anchoring to the date the prepayment was
 * made would drag every future due-day to that day. Installment #1 is never
 * clamped (offset 0), and either stays in place (already paid) or is
 * regenerated at offset 0 from itself, so it always carries the loan's real
 * due day. Falls back to the next pending installment only if #1 is somehow
 * missing.
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
 * The expense category a lent loan's prepayment charge is filed under: the
 * built-in "Fees & Charges" (is_system, so it can't have been renamed,
 * archived or deleted), or — only if that row is somehow missing — the
 * first active expense category.
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

// Shared by every query that returns full Loan rows — joins in the earliest
// pending installment's due date so the list screen can show "Next due"
// without a second round-trip per loan.
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
