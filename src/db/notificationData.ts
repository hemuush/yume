import { getDb } from './client';
import type { PlanLoan } from '@/lib/notificationPlan';

/** What planNotifications needs from the database: the next EMI of each active borrowed loan, and whether anything was logged today. */

export async function listLoansDue(): Promise<PlanLoan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    counterparty: string;
    due_date: string;
    emi_amount_minor: number;
  }>(
    `SELECT l.id AS id, l.counterparty AS counterparty, p.due_date AS due_date, p.emi_amount_minor AS emi_amount_minor
     FROM loans l
     JOIN loan_payments p ON p.loan_id = l.id AND p.status = 'pending'
     WHERE l.direction = 'borrowed' AND l.status = 'active'
       AND p.installment_number = (
         SELECT MIN(q.installment_number) FROM loan_payments q WHERE q.loan_id = l.id AND q.status = 'pending'
       )`
  );
  return rows.map((r) => ({
    id: r.id,
    counterparty: r.counterparty,
    dueDate: r.due_date,
    emiMinor: r.emi_amount_minor,
  }));
}

/** Whether something of the user's own is logged on `dateIso` — loan EMIs and loan bookkeeping don't count, as Yume writes those itself. */
export async function hasLoggedOn(dateIso: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions WHERE date = ? AND loan_payment_id IS NULL AND loan_id IS NULL`,
    [dateIso]
  );
  return (row?.n ?? 0) > 0;
}
