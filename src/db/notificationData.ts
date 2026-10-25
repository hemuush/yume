import { getDb } from './client';
import type { PlanLoan } from '@/lib/notificationPlan';
import { addDaysToIsoDate } from '@/lib/date';
import { getHideSensitiveAmounts } from './settings';

/** Only the next active recurring expense, and outstanding dated refund expectations. No forecasted cash is posted. */
export async function listReminderAttention(today: string, recurring: boolean, refunds: boolean) {
  const db = await getDb();
  const privacy = (await getHideSensitiveAmounts())
    ? `AND a.type <> 'savings' AND c.id IS NOT NULL
    AND (c.parent_id IS NULL OR EXISTS (SELECT 1 FROM categories parent WHERE parent.id = c.parent_id))
    AND NOT EXISTS (
    SELECT 1 FROM categories hidden WHERE hidden.is_sensitive = 1
    AND COALESCE(hidden.parent_id, hidden.id) = COALESCE(c.parent_id, c.id)
  )`
    : '';
  const items: { kind: 'bill' | 'refund'; id: string; label: string; date: string }[] = [];
  if (recurring) {
    const rows = await db.getAllAsync<{ id: string; label: string; date: string }>(
      `SELECT r.id, COALESCE(NULLIF(trim(r.note), ''), c.name, 'Recurring bill') AS label, r.next_run_date AS date
       FROM recurring_rules r JOIN accounts a ON a.id = r.account_id LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.active = 1 AND r.type = 'expense' AND a.archived = 0 AND c.archived = 0
       AND (c.parent_id IS NULL OR EXISTS (SELECT 1 FROM categories parent WHERE parent.id = c.parent_id AND parent.archived = 0))
       AND r.next_run_date BETWEEN ? AND ? AND (r.end_date IS NULL OR r.next_run_date <= r.end_date) ${privacy}`,
      [addDaysToIsoDate(today, 1), addDaysToIsoDate(today, 14)]
    );
    items.push(...rows.map((row) => ({ ...row, kind: 'bill' as const })));
  }
  if (refunds) {
    const rows = await db.getAllAsync<{ id: string; label: string; date: string }>(
      `SELECT r.id, COALESCE(NULLIF(trim(p.note), ''), c.name, 'Purchase') AS label, r.due_date AS date
       FROM refund_expectations r JOIN transactions p ON p.id = r.transaction_id JOIN accounts a ON a.id = p.account_id LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN refund_receipts rr ON rr.expectation_id = r.id LEFT JOIN transactions t ON t.id = rr.transaction_id
       WHERE r.closed = 0 AND r.due_date BETWEEN ? AND ? ${privacy} GROUP BY r.id
       HAVING r.expected_amount_minor > COALESCE(SUM(t.amount_minor), 0)`,
      [addDaysToIsoDate(today, -3), addDaysToIsoDate(today, 13)]
    );
    items.push(...rows.map((row) => ({ ...row, kind: 'refund' as const })));
  }
  return items;
}

/** The next unpaid EMI of each non-closed borrowed loan, for planNotifications. */
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
     JOIN loan_payments p ON p.loan_id = l.id AND p.status IN ('pending', 'overdue')
     WHERE l.direction = 'borrowed' AND l.status != 'closed'
       AND p.installment_number = (
         SELECT MIN(q.installment_number) FROM loan_payments q WHERE q.loan_id = l.id AND q.status IN ('pending', 'overdue')
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
    `SELECT COUNT(*) AS n FROM transactions t WHERE t.date = ? AND t.loan_payment_id IS NULL AND t.loan_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM loan_payments p WHERE p.transaction_id = t.id)`,
    [dateIso]
  );
  return (row?.n ?? 0) > 0;
}
