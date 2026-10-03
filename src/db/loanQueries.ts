import { LoanPaymentRow, LoanRateChangeRow, LoanRow } from './rows';
import { getDb } from './client';
import { Loan, LoanPayment } from '@/types';

import { rowToLoan, LOAN_SELECT, rowToLoanPayment } from './loanRows';

/** Reading loans: lists, schedules, progress and what is due next (re-exported from ./loans). */

export async function listLoans(): Promise<Loan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LoanRow & { next_due_date: string | null }>(
    `${LOAN_SELECT} ORDER BY l.created_at DESC`
  );
  return rows.map(rowToLoan);
}

export interface LoanProgress {
  loanId: string;
  /** Installments marked paid — including ones paid before the loan was entered. */
  paidCount: number;
  /** Installments on the schedule, paid or pending. */
  totalCount: number;
  /** The earliest pending installment's due date and amount; null once nothing is pending. */
  nextDueDate: string | null;
  nextEmiMinor: number | null;
  /** The last pending installment's due date — when the loan is done. Null once nothing is pending. */
  lastDueDate: string | null;
  /** Interest still to be paid across the pending installments (0 once nothing is pending). */
  pendingInterestMinor: number;
}

/**
 * Every loan's schedule progress in one grouped query — Plan's Loans card
 * shows "42 of 240 paid" and the next EMI for each loan, which would
 * otherwise be one full schedule read per loan through the shared queue.
 * The next EMI's amount is the pending installment's own (a loan's last
 * installment usually differs from its regular EMI).
 */
export async function getLoanProgress(): Promise<LoanProgress[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    loan_id: string;
    paid_count: number;
    total_count: number;
    next_due_date: string | null;
    next_emi_minor: number | null;
    last_due_date: string | null;
    pending_interest_minor: number;
  }>(
    `SELECT l.id AS loan_id,
       (SELECT COUNT(*) FROM loan_payments p WHERE p.loan_id = l.id AND p.status = 'paid') AS paid_count,
       (SELECT COUNT(*) FROM loan_payments p WHERE p.loan_id = l.id) AS total_count,
       (SELECT p.due_date FROM loan_payments p WHERE p.loan_id = l.id AND p.status = 'pending'
          ORDER BY p.installment_number ASC LIMIT 1) AS next_due_date,
       (SELECT p.emi_amount_minor FROM loan_payments p WHERE p.loan_id = l.id AND p.status = 'pending'
          ORDER BY p.installment_number ASC LIMIT 1) AS next_emi_minor,
       (SELECT MAX(p.due_date) FROM loan_payments p WHERE p.loan_id = l.id AND p.status = 'pending') AS last_due_date,
       (SELECT COALESCE(SUM(p.interest_component_minor), 0) FROM loan_payments p
          WHERE p.loan_id = l.id AND p.status = 'pending') AS pending_interest_minor
     FROM loans l`
  );
  return rows.map((r) => ({
    loanId: r.loan_id,
    paidCount: r.paid_count,
    totalCount: r.total_count,
    nextDueDate: r.next_due_date ?? null,
    nextEmiMinor: r.next_emi_minor ?? null,
    lastDueDate: r.last_due_date ?? null,
    pendingInterestMinor: r.pending_interest_minor,
  }));
}

export async function listLoansForPerson(personId: string): Promise<Loan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LoanRow & { next_due_date: string | null }>(
    `${LOAN_SELECT} WHERE l.person_id = ? ORDER BY l.created_at DESC`,
    [personId]
  );
  return rows.map(rowToLoan);
}

export async function getLoanById(id: string): Promise<Loan | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<LoanRow & { next_due_date: string | null }>(
    `${LOAN_SELECT} WHERE l.id = ?`,
    [id]
  );
  return row ? rowToLoan(row) : null;
}

export async function getLoanSchedule(loanId: string): Promise<LoanPayment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LoanPaymentRow>(
    'SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY installment_number ASC',
    [loanId]
  );
  return rows.map(rowToLoanPayment);
}

/** What paying a loan's next EMI needs — see getLoanPaymentContext. */
export interface LoanPaymentContext {
  installment: LoanPayment;
  account: { id: string; name: string } | null;
  categoryId: string | null;
}

/**
 * A loan's next unpaid EMI, the account it's paid from and the category it's
 * filed under — the same choices the loan's own screen makes: its linked
 * account if that still exists (otherwise the first account), and "Loan EMI"
 * (or "Loan Repayment" for money lent) of the matching kind. Null when
 * nothing is left to pay. Lets Plan's Coming up record an EMI in one tap.
 */
export async function getLoanPaymentContext(loanId: string): Promise<LoanPaymentContext | null> {
  const db = await getDb();
  const loan = await db.getFirstAsync<{ direction: 'borrowed' | 'lent'; linked_account_id: string | null }>(
    'SELECT direction, linked_account_id FROM loans WHERE id = ?',
    [loanId]
  );
  if (!loan) return null;
  const next = await db.getFirstAsync<LoanPaymentRow>(
    `SELECT * FROM loan_payments WHERE loan_id = ? AND status = 'pending' ORDER BY installment_number ASC LIMIT 1`,
    [loanId]
  );
  if (!next) return null;
  const accounts = await db.getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM accounts WHERE archived = 0 ORDER BY created_at ASC'
  );
  const account = accounts.find((a) => a.id === loan.linked_account_id) ?? accounts[0] ?? null;
  const kind = loan.direction === 'borrowed' ? 'expense' : 'income';
  const categories = await db.getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM categories WHERE kind = ? AND archived = 0 ORDER BY name COLLATE NOCASE',
    [kind]
  );
  const category =
    categories.find((c) => c.name === 'Loan EMI' || c.name === 'Loan Repayment') ?? categories[0] ?? null;
  return { installment: rowToLoanPayment(next), account, categoryId: category?.id ?? null };
}

export interface LoanRateChange {
  id: string;
  loanId: string;
  oldRateAnnualBp: number;
  newRateAnnualBp: number;
  effectiveDate: string;
  mode: 'keepEmi' | 'keepTenure';
  oldEmiAmountMinor: number;
  newEmiAmountMinor: number;
}

/** Every recorded rate change for a loan, most recent effective date first — the answer to "when did this actually change". */
export async function getLoanRateHistory(loanId: string): Promise<LoanRateChange[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LoanRateChangeRow>(
    'SELECT * FROM loan_rate_changes WHERE loan_id = ? ORDER BY effective_date DESC, created_at DESC',
    [loanId]
  );
  return rows.map((row) => ({
    id: row.id,
    loanId: row.loan_id,
    oldRateAnnualBp: row.old_rate_annual_bp,
    newRateAnnualBp: row.new_rate_annual_bp,
    effectiveDate: row.effective_date,
    mode: row.mode,
    oldEmiAmountMinor: row.old_emi_amount_minor,
    newEmiAmountMinor: row.new_emi_amount_minor,
  }));
}

export interface NextDueInstallment {
  loanId: string;
  counterparty: string;
  emiAmountMinor: number;
  dueDate: string;
}

/** The single nearest pending installment across every active borrowed loan, for a Home-screen reminder. */
export async function getNextDueInstallment(): Promise<NextDueInstallment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    emi_amount_minor: number;
    due_date: string;
    loan_id: string;
    counterparty: string;
  }>(
    `SELECT lp.emi_amount_minor as emi_amount_minor, lp.due_date as due_date, l.id as loan_id, l.counterparty as counterparty
     FROM loan_payments lp
     JOIN loans l ON l.id = lp.loan_id
     WHERE lp.status = 'pending' AND l.direction = 'borrowed' AND l.status = 'active'
     ORDER BY lp.due_date ASC
     LIMIT 1`
  );
  if (!row) return null;
  return {
    loanId: row.loan_id,
    counterparty: row.counterparty,
    emiAmountMinor: row.emi_amount_minor,
    dueDate: row.due_date,
  };
}
