import { getDb } from './client';
import { getCachedCurrency } from './settings';
import { SPEND_ROWS, SPEND_AMOUNT, PUBLIC_CATEGORY_FAMILY } from './spendSql';

export async function listExpenseLabels(query = '', hideSensitive = false): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ label: string }>(
    `SELECT trim(t.note) AS label FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND trim(t.note) <> ''
     AND instr(lower(trim(t.note)), lower(?)) > 0 ${hideSensitive ? `AND ${PUBLIC_CATEGORY_FAMILY}` : ''}
     GROUP BY trim(t.note) ORDER BY MAX(t.date) DESC, label ASC LIMIT 50`,
    [getCachedCurrency(), query.trim()]
  );
  return rows.map((row) => row.label);
}

export async function expenseLabelTotals(from: string, to: string, hideSensitive: boolean) {
  const db = await getDb();
  return db.getAllAsync<{ label: string; totalMinor: number; count: number }>(
    `SELECT trim(t.note) AS label, SUM(${SPEND_AMOUNT}) AS totalMinor,
     SUM(CASE WHEN t.type = 'expense' THEN 1 ELSE 0 END) AS count
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date BETWEEN ? AND ?
     ${hideSensitive ? `AND ${PUBLIC_CATEGORY_FAMILY}` : ''}
     GROUP BY trim(t.note) ORDER BY totalMinor DESC, label ASC`,
    [getCachedCurrency(), from, to]
  );
}
