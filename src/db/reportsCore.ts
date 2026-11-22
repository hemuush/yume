import { getDb } from './client';
import type { AppDb } from './dbTypes';
import { toLocalIsoDate } from '@/lib/date';
import { getDefaultCurrency } from './settings';
import type { DateRange } from '@/types';
import {
  SPEND_ROWS,
  SPEND_AMOUNT,
  INCOME_ROWS,
  NOT_SENSITIVE,
  rowsOf,
  amountOf,
  sensitiveOf,
} from './spendSql';

type ReportPeriod = 'day' | 'week' | 'month' | 'year';

// Defined in @/types (so src/lib can use it without importing the db layer); re-exported here for existing callers.

const toIso = toLocalIsoDate;

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sunday
  copy.setDate(copy.getDate() - day);
  return copy;
}

/** Current period range, and the equivalent prior period for comparison. */
export function getPeriodRanges(
  period: ReportPeriod,
  reference: Date = new Date()
): {
  current: DateRange;
  previous: DateRange;
} {
  const ref = new Date(reference);

  if (period === 'day') {
    const cur = toIso(ref);
    const prev = new Date(ref);
    prev.setDate(prev.getDate() - 1);
    return { current: { start: cur, end: cur }, previous: { start: toIso(prev), end: toIso(prev) } };
  }

  if (period === 'week') {
    const curStart = startOfWeek(ref);
    const curEnd = new Date(curStart);
    curEnd.setDate(curEnd.getDate() + 6);
    const prevStart = new Date(curStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(curEnd);
    prevEnd.setDate(prevEnd.getDate() - 7);
    return {
      current: { start: toIso(curStart), end: toIso(curEnd) },
      previous: { start: toIso(prevStart), end: toIso(prevEnd) },
    };
  }

  if (period === 'month') {
    const curStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const curEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const prevStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const prevEnd = new Date(ref.getFullYear(), ref.getMonth(), 0);
    return {
      current: { start: toIso(curStart), end: toIso(curEnd) },
      previous: { start: toIso(prevStart), end: toIso(prevEnd) },
    };
  }

  // year
  const curStart = new Date(ref.getFullYear(), 0, 1);
  const curEnd = new Date(ref.getFullYear(), 11, 31);
  const prevStart = new Date(ref.getFullYear() - 1, 0, 1);
  const prevEnd = new Date(ref.getFullYear() - 1, 11, 31);
  return {
    current: { start: toIso(curStart), end: toIso(curEnd) },
    previous: { start: toIso(prevStart), end: toIso(prevEnd) },
  };
}

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  color: string;
  totalMinor: number;
  /** True if this row has subcategories whose spend was rolled up into totalMinor — the Reports screen uses this to offer a drill-down into the split. */
  hasSubcategories: boolean;
  /** True if this row itself, or any subcategory rolled into it, is flagged "hide savings & investment amounts" — the Reports screen masks totalMinor when the global privacy toggle is also on. */
  isSensitive: boolean;
  /** How many entries make up totalMinor. Filled by getSubcategoryBreakdown (a category page's split). */
  count?: number;
}

export interface PeriodSummary {
  incomeMinor: number;
  expenseMinor: number;
  // income - expense - savingsContributionMinor: money already moved into savings no longer counts as
  // "surplus" (it's been acted on); withdrawing from savings goes negative, adding back to net.
  netMinor: number;
  savingsContributionMinor: number; // net money moved into savings-type accounts
  categoryBreakdown: CategoryBreakdownItem[];
  /** Where money came in, rolled up the same way — Reports' Income view. */
  incomeBreakdown: CategoryBreakdownItem[];
}

/**
 * Every aggregate here joins `accounts` and filters to the default currency: transactions carry no currency,
 * so summing across currencies would add face values; other-currency accounts work individually, just not here.
 */
export async function getPeriodSummary(range: DateRange): Promise<PeriodSummary> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  // The amounts and the category breakdown used for privacy must describe the same ledger state.
  return db.exclusiveAsync((connection) => readPeriodSummary(connection, range, currency), {
    readOnly: true,
  });
}

async function readPeriodSummary(db: AppDb, range: DateRange, currency: string): Promise<PeriodSummary> {
  const income = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(t.amount_minor) as total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${INCOME_ROWS} AND a.currency = ? AND t.date >= ? AND t.date <= ?`,
    [currency, range.start, range.end]
  );
  const expense = await db.getFirstAsync<{ total: number | null }>(
    // Spending less whatever came back as refunds.
    `SELECT SUM(${SPEND_AMOUNT}) as total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date >= ? AND t.date <= ?`,
    [currency, range.start, range.end]
  );

  const savingsIn = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(t.amount_minor) as total FROM transactions t
     JOIN accounts a ON a.id = t.to_account_id
     WHERE t.type = 'transfer' AND a.type = 'savings' AND a.currency = ? AND t.date >= ? AND t.date <= ?`,
    [currency, range.start, range.end]
  );
  const savingsOut = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(t.amount_minor) as total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'transfer' AND a.type = 'savings' AND a.currency = ? AND t.date >= ? AND t.date <= ?`,
    [currency, range.start, range.end]
  );

  // Rolled up to the top-level category: subcategory spend folds into its parent's row, not its own slice.
  // `hasSubcategories` says whether the row can be drilled into via getSubcategoryBreakdown.
  const breakdownOf = (type: 'expense' | 'income') =>
    db.getAllAsync<{
      categoryId: string;
      name: string;
      color: string;
      total: number;
      hasSubcategories: number;
      isSensitive: number;
    }>(
      `SELECT top.id as categoryId, top.name as name, top.color as color, SUM(${amountOf(type)}) as total,
         EXISTS(SELECT 1 FROM categories ch WHERE ch.parent_id = top.id AND ch.archived = 0) as hasSubcategories,
         MAX(${sensitiveOf('c')}) as isSensitive
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       JOIN categories top ON top.id = COALESCE(c.parent_id, c.id)
       JOIN accounts a ON a.id = t.account_id
       WHERE ${rowsOf(type)} AND a.currency = ? AND t.date >= ? AND t.date <= ?
       GROUP BY top.id
       HAVING total > 0
       ORDER BY total DESC`,
      [currency, range.start, range.end]
    );
  const breakdown = await breakdownOf('expense');
  const incomeRows = await breakdownOf('income');
  const toItem = (r: {
    categoryId: string;
    name: string;
    color: string;
    total: number;
    hasSubcategories: number;
    isSensitive: number;
  }): CategoryBreakdownItem => ({
    categoryId: r.categoryId,
    name: r.name,
    color: r.color,
    totalMinor: r.total,
    hasSubcategories: !!r.hasSubcategories,
    isSensitive: !!r.isSensitive,
  });

  const savingsContributionMinor = (savingsIn?.total ?? 0) - (savingsOut?.total ?? 0);
  // Refunds bigger than a period's spending leave it at zero, never below.
  const expenseMinor = Math.max(0, expense?.total ?? 0);
  return {
    incomeMinor: income?.total ?? 0,
    expenseMinor,
    netMinor: (income?.total ?? 0) - expenseMinor - savingsContributionMinor,
    savingsContributionMinor,
    categoryBreakdown: breakdown.map(toItem),
    incomeBreakdown: incomeRows.map(toItem),
  };
}

/**
 * Leftover from everything before `before` (YYYY-MM-DD): income − spending − savings moved, as in a period's
 * free-to-use, so it rolls forward. Negative if over. Default currency; `excludeSensitive` omits savings.
 */
export async function getCarryInMinor(before: string, excludeSensitive = false): Promise<number> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const clean = excludeSensitive ? ` AND ${NOT_SENSITIVE}` : '';
  const row = await db.getFirstAsync<{ income: number | null; expense: number | null; saved: number | null }>(
    `SELECT
       (SELECT SUM(t.amount_minor) FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE ${INCOME_ROWS} AND a.currency = ? AND t.date < ?${clean}) AS income,
       (SELECT SUM(${SPEND_AMOUNT}) FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date < ?${clean}) AS expense,
       (SELECT COALESCE(SUM(t.amount_minor), 0) FROM transactions t JOIN accounts a ON a.id = t.to_account_id
         WHERE t.type = 'transfer' AND a.type = 'savings' AND a.currency = ? AND t.date < ?)
       - (SELECT COALESCE(SUM(t.amount_minor), 0) FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE t.type = 'transfer' AND a.type = 'savings' AND a.currency = ? AND t.date < ?) AS saved`,
    [currency, before, currency, before, currency, before, currency, before]
  );
  return (row?.income ?? 0) - (row?.expense ?? 0) - (row?.saved ?? 0);
}
