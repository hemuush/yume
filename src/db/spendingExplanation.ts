import { getDb } from './client';
import { DateRange } from '@/types';
import { explainSpending, matchedSpendingRanges, SpendingFacts } from '@/lib/spendingExplanation';
import { NOT_SENSITIVE } from './spendSql';
import { toLocalIsoDate } from '@/lib/date';
export async function getSpendingExplanation(
  categoryId: string,
  current: DateRange,
  previous: DateRange,
  hideAmounts: boolean
) {
  const ranges = matchedSpendingRanges(current, previous, toLocalIsoDate(new Date()));
  return (await getDb()).exclusiveAsync(async (db) => {
    const scope = `FROM transactions t JOIN categories c ON c.id = t.category_id JOIN accounts a ON a.id = t.account_id
      WHERE (c.id = ? OR c.parent_id = ?) AND a.currency = COALESCE((SELECT value FROM settings WHERE key = 'default_currency'), 'INR')
      AND t.date BETWEEN ? AND ? ${hideAmounts ? `AND ${NOT_SENSITIVE}` : ''}`;
    const facts = async (range: DateRange): Promise<SpendingFacts> => {
      const row = await db.getFirstAsync<{ gross: number; refunded: number; purchases: number }>(
        `SELECT COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE 0 END), 0) AS gross,
         COALESCE(SUM(CASE WHEN t.type = 'income' AND t.is_refund = 1 THEN t.amount_minor ELSE 0 END), 0) AS refunded,
         COUNT(DISTINCT CASE WHEN t.type = 'expense' THEN COALESCE(t.split_id, t.id) END) AS purchases ${scope}`,
        [categoryId, categoryId, range.start, range.end]
      );
      return { grossMinor: row?.gross ?? 0, refundMinor: row?.refunded ?? 0, count: row?.purchases ?? 0 };
    };
    const now = await facts(ranges.current),
      before = await facts(ranges.previous);
    const largest = await db.getAllAsync<{ id: string; amount_minor: number; date: string; note: string }>(
      `SELECT t.id, t.amount_minor, t.date, t.note ${scope} AND t.type = 'expense' ORDER BY t.amount_minor DESC, t.date DESC LIMIT 3`,
      [categoryId, categoryId, ranges.current.start, ranges.current.end]
    );
    return { ...explainSpending(now, before), current: now, previous: before, ranges, largest };
  });
}
