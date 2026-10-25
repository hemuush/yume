import { getDb } from './client';
import { SPEND_AMOUNT } from './spendSql';

export interface EntryMonth {
  /** `YYYY-MM`. */
  month: string;
  /** Every entry that month, in any currency. */
  count: number;
  /** Net spending in `currency`, including negative months so refunds reconcile across a year. */
  spentMinor: number;
}

/** One row per month that has entries, so the export picker offers only real months and can say what is in them. */
export async function listEntryMonths(currency: string): Promise<EntryMonth[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ month: string; count: number; spent: number | null }>(
    `SELECT substr(t.date, 1, 7) AS month,
            COUNT(*) AS count,
            SUM(CASE WHEN a.currency = ? AND (t.type = 'expense' OR (t.type = 'income' AND t.is_refund = 1))
                     THEN ${SPEND_AMOUNT} ELSE 0 END) AS spent
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     GROUP BY month
     ORDER BY month DESC`,
    [currency]
  );
  return rows
    .filter((r) => /^\d{4}-\d{2}$/.test(r.month))
    .map((r) => ({ month: r.month, count: r.count, spentMinor: r.spent ?? 0 }));
}
