import { getDb } from './client';
import { toLocalIsoDate, addDaysToIsoDate, isoDatesInRange, monthsBetweenIsoDates } from '@/lib/date';
import { streakSeries } from '@/lib/gardenGrowth';
import { getDefaultCurrency } from './settings';
import { valuationAdjSql } from './valuationSql';
import type { Account, DateRange } from '@/types';
import { SPEND_ROWS, SPEND_AMOUNT, INCOME_ROWS, NOT_SENSITIVE, rowsOf, amountOf, countOf } from './spendSql';

export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

// Defined in @/types (so src/lib can use it without importing the db layer); re-exported here for existing callers.
export type { DateRange };

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
         MAX(c.is_sensitive) as isSensitive
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

/**
 * The split behind one rolled-up category row: one entry per subcategory plus "Other <name>" for spend tagged
 * directly to the parent itself. Powers the drill-down when `hasSubcategories` is true.
 */
export async function getSubcategoryBreakdown(
  parentCategoryId: string,
  range: DateRange,
  kind: 'expense' | 'income' = 'expense'
): Promise<CategoryBreakdownItem[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const parent = await db.getFirstAsync<{ name: string; color: string }>(
    'SELECT name, color FROM categories WHERE id = ?',
    [parentCategoryId]
  );
  const rows = await db.getAllAsync<{
    categoryId: string;
    name: string;
    color: string;
    total: number;
    count: number;
    isSensitive: number;
  }>(
    `SELECT c.id as categoryId, c.name as name, c.color as color, SUM(${amountOf(kind)}) as total,
       ${countOf(kind)} as count, c.is_sensitive as isSensitive
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN accounts a ON a.id = t.account_id
     WHERE ${rowsOf(kind)} AND a.currency = ? AND t.date >= ? AND t.date <= ?
       AND (c.id = ? OR c.parent_id = ?)
     GROUP BY c.id
     HAVING total > 0
     ORDER BY total DESC`,
    [currency, range.start, range.end, parentCategoryId, parentCategoryId]
  );
  return rows.map((r) => ({
    categoryId: r.categoryId,
    name: r.categoryId === parentCategoryId ? `Other ${parent?.name ?? r.name}` : r.name,
    color: r.color,
    totalMinor: r.total,
    hasSubcategories: false,
    isSensitive: !!r.isSensitive,
    count: r.count,
  }));
}

/** One account's share of a period's spending (or income): its total and the categories behind it. */
export interface AccountBreakdownItem {
  accountId: string;
  name: string;
  type: Account['type'];
  totalMinor: number;
  /** The account's biggest top-level categories (at most three), largest first. */
  topCategories: CategoryBreakdownItem[];
}

const ACCOUNT_TOP_CATEGORIES = 3;

/**
 * Where a period's spending (or income) went by account: largest first, each with its top 3 categories
 * (subcategories rolled up). Default currency, refunds off; `excludeSensitive` drops savings/investments.
 */
export async function getAccountBreakdown(
  range: DateRange,
  kind: 'expense' | 'income' = 'expense',
  excludeSensitive = false
): Promise<AccountBreakdownItem[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const clean = excludeSensitive ? ` AND ${NOT_SENSITIVE}` : '';
  const where = `${rowsOf(kind)} AND a.currency = ? AND t.date >= ? AND t.date <= ?${clean}`;
  const args = [currency, range.start, range.end];

  const accounts = await db.getAllAsync<{ id: string; name: string; type: Account['type']; total: number }>(
    `SELECT a.id as id, a.name as name, a.type as type, SUM(${amountOf(kind)}) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${where}
     GROUP BY a.id
     HAVING total > 0
     ORDER BY total DESC, a.name`,
    args
  );
  if (accounts.length === 0) return [];

  const cats = await db.getAllAsync<{
    accountId: string;
    categoryId: string;
    name: string;
    color: string;
    total: number;
    isSensitive: number;
  }>(
    `SELECT t.account_id as accountId, top.id as categoryId, top.name as name, top.color as color,
       SUM(${amountOf(kind)}) as total, MAX(c.is_sensitive) as isSensitive
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN categories top ON top.id = COALESCE(c.parent_id, c.id)
     JOIN accounts a ON a.id = t.account_id
     WHERE ${where}
     GROUP BY t.account_id, top.id
     HAVING total > 0
     ORDER BY total DESC, top.name`,
    args
  );
  const byAccount = new Map<string, CategoryBreakdownItem[]>();
  for (const r of cats) {
    const list = byAccount.get(r.accountId) ?? [];
    if (list.length >= ACCOUNT_TOP_CATEGORIES) continue;
    list.push({
      categoryId: r.categoryId,
      name: r.name,
      color: r.color,
      totalMinor: r.total,
      hasSubcategories: false,
      isSensitive: !!r.isSensitive,
    });
    byAccount.set(r.accountId, list);
  }
  return accounts.map((a) => ({
    accountId: a.id,
    name: a.name,
    type: a.type,
    totalMinor: a.total,
    topCategories: byAccount.get(a.id) ?? [],
  }));
}

/** One single entry among a period's biggest. */
export interface LargestExpense {
  id: string;
  date: string;
  amountMinor: number;
  categoryId: string | null;
  note: string;
}

/**
 * The period's biggest single expenses, largest first (ties: later date). Gross amounts: a refund is its own
 * row and doesn't shrink its entry. `categoryId` narrows to that category and subcategories (heatmap's filter).
 */
export async function getLargestExpenses(
  range: DateRange,
  limit = 5,
  excludeSensitive = false,
  categoryId?: string
): Promise<LargestExpense[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    amount: number;
    categoryId: string | null;
    note: string;
  }>(
    `SELECT t.id as id, t.date as date, t.amount_minor as amount, t.category_id as categoryId, t.note as note
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'expense' AND a.currency = ? AND t.date >= ? AND t.date <= ?${
       excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''
     }${
       categoryId
         ? ` AND (t.category_id = ? OR t.category_id IN (SELECT id FROM categories WHERE parent_id = ?))`
         : ''
     }
     ORDER BY t.amount_minor DESC, t.date DESC, t.id
     LIMIT ?`,
    categoryId
      ? [currency, range.start, range.end, categoryId, categoryId, limit]
      : [currency, range.start, range.end, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amountMinor: r.amount,
    categoryId: r.categoryId,
    note: r.note,
  }));
}

export interface CategoryOverview {
  /** The period's total for the category, its subcategories included (refunds already taken off). */
  totalMinor: number;
  /** Money that came back to this category as refunds in the period; 0 for an income category. */
  refundMinor: number;
  /** What was spent before any refunds (equals `totalMinor` when there were none). */
  spentMinor: number;
  count: number;
  /** Per subcategory (the parent's own entries as "Other …"), largest first — see getSubcategoryBreakdown. */
  split: CategoryBreakdownItem[];
  /** The last `months` calendar months ending with the period's last month, oldest first. */
  months: { month: string; totalMinor: number }[];
}

/**
 * Everything the category page shows for a category over a period: total, entry count, inner breakdown, monthly
 * totals. Subcategories roll up as Reports does, so the page and Reports always agree.
 */
export async function getCategoryOverview(
  categoryId: string,
  kind: 'expense' | 'income',
  range: DateRange,
  months = 6
): Promise<CategoryOverview> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const inCategory = `(t.category_id = ? OR t.category_id IN (SELECT id FROM categories WHERE parent_id = ?))`;

  const totals = await db.getFirstAsync<{
    total: number | null;
    count: number | null;
    refund: number | null;
    spent: number | null;
  }>(
    `SELECT SUM(${amountOf(kind)}) AS total, ${countOf(kind)} AS count,
       SUM(CASE WHEN t.type = 'income' AND t.is_refund = 1 THEN t.amount_minor ELSE 0 END) AS refund,
       SUM(CASE WHEN t.type = 'income' AND t.is_refund = 1 THEN 0 ELSE t.amount_minor END) AS spent
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${rowsOf(kind)} AND a.currency = ? AND t.date >= ? AND t.date <= ? AND ${inCategory}`,
    [currency, range.start, range.end, categoryId, categoryId]
  );

  const [y, m] = range.end.split('-').map(Number);
  const monthKeys = Array.from({ length: months }, (_, i) => {
    const d = new Date(y, m - 1 - (months - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const lastDay = new Date(y, m, 0).getDate();
  const rows = await db.getAllAsync<{ month: string; total: number }>(
    `SELECT substr(t.date, 1, 7) AS month, SUM(${amountOf(kind)}) AS total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${rowsOf(kind)} AND a.currency = ? AND t.date >= ? AND t.date <= ? AND ${inCategory}
     GROUP BY month`,
    [
      currency,
      `${monthKeys[0]}-01`,
      `${monthKeys[months - 1]}-${String(lastDay).padStart(2, '0')}`,
      categoryId,
      categoryId,
    ]
  );
  // A month whose refunds outweighed its spending shows as zero, never below.
  const byMonth = new Map(rows.map((r) => [r.month, Math.max(0, r.total)]));

  return {
    totalMinor: Math.max(0, totals?.total ?? 0),
    refundMinor: kind === 'expense' ? (totals?.refund ?? 0) : 0,
    spentMinor: totals?.spent ?? 0,
    count: totals?.count ?? 0,
    split: await getSubcategoryBreakdown(categoryId, range, kind),
    months: monthKeys.map((month) => ({ month, totalMinor: byMonth.get(month) ?? 0 })),
  };
}

/**
 * "Your usual" for a category: the average of the three months before the last one in the series, only once all
 * three had spending (fewer say too little). Null otherwise.
 */
export function usualMonthly(months: { totalMinor: number }[]): number | null {
  const before = months.slice(-4, -1);
  if (before.length < 3 || before.some((mo) => mo.totalMinor <= 0)) return null;
  return Math.round(before.reduce((sum, mo) => sum + mo.totalMinor, 0) / 3);
}

export interface DailyExpensePoint {
  date: string; // YYYY-MM-DD
  totalMinor: number;
}

/**
 * Total expense for each day with spending within `range`, in one grouped query. With `categoryId`, only that
 * category's spending, subcategories rolled in (same grouping as Reports' category rows).
 */
export async function getDailyExpenseTotals(
  range: DateRange,
  excludeSensitive = false,
  categoryId?: string
): Promise<DailyExpensePoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const rows = await db.getAllAsync<{ date: string; total: number }>(
    `SELECT t.date as date, SUM(${SPEND_AMOUNT}) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date >= ? AND t.date <= ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}${
       categoryId
         ? ` AND (t.category_id = ? OR t.category_id IN (SELECT id FROM categories WHERE parent_id = ?))`
         : ''
     }
     GROUP BY t.date`,
    categoryId
      ? [currency, range.start, range.end, categoryId, categoryId]
      : [currency, range.start, range.end]
  );
  // A refund lowers its day's spending, but a day never goes below zero.
  return rows
    .map((r) => ({ date: r.date, totalMinor: Math.max(0, r.total) }))
    .filter((r) => r.totalMinor > 0);
}

/**
 * Today's total spend, scoped like every other spend figure (expense-type, default-currency accounts) but for
 * one day. Powers Home's "Today" strip; reuses getDailyExpenseTotals's query shape.
 */
export async function getTodaySpend(
  today: string = toIso(new Date()),
  excludeSensitive = false
): Promise<number> {
  const totals = await getDailyExpenseTotals({ start: today, end: today }, excludeSensitive);
  return totals[0]?.totalMinor ?? 0;
}

/**
 * Home's forecast inputs (lib/pace.ts): everyday spend 1st→`today` (excl. Loan EMI, fees, Friends & Family)
 * plus still-due this month: pending borrowed-loan EMIs and active recurring expenses. Default currency only.
 */
export async function getMonthPaceInputs(
  today: string = toIso(new Date())
): Promise<{ everydaySpentMinor: number; dueRestOfMonthMinor: number }> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split('-').map(Number);
  const monthEnd = `${today.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

  const everyday = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(${SPEND_AMOUNT}) AS total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND IFNULL(c.is_system, 0) = 0
       AND t.date >= ? AND t.date <= ?`,
    [currency, monthStart, today]
  );
  const emis = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(p.emi_amount_minor) AS total FROM loan_payments p
     JOIN loans l ON l.id = p.loan_id
     WHERE p.status = 'pending' AND l.status = 'active' AND l.direction = 'borrowed'
       AND p.due_date > ? AND p.due_date <= ?`,
    [today, monthEnd]
  );
  const bills = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(r.amount_minor) AS total FROM recurring_rules r
     JOIN accounts a ON a.id = r.account_id
     WHERE r.active = 1 AND r.type = 'expense' AND a.currency = ?
       AND r.next_run_date > ? AND r.next_run_date <= ?`,
    [currency, today, monthEnd]
  );
  return {
    everydaySpentMinor: Math.max(0, everyday?.total ?? 0),
    dueRestOfMonthMinor: (emis?.total ?? 0) + (bills?.total ?? 0),
  };
}

/**
 * Still owed this month, not yet spent: pending EMIs on active borrowed loans due by month end (overdue and
 * due today count) and active recurring expenses after `today` (earlier ones already posted). Default currency.
 */
export async function getStillToPayThisMonth(today: string = toIso(new Date())): Promise<number> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split('-').map(Number);
  const monthEnd = `${today.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const emis = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(p.emi_amount_minor) AS total FROM loan_payments p
     JOIN loans l ON l.id = p.loan_id
     WHERE p.status = 'pending' AND l.status = 'active' AND l.direction = 'borrowed'
       AND p.due_date >= ? AND p.due_date <= ?`,
    [monthStart, monthEnd]
  );
  const bills = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(r.amount_minor) AS total FROM recurring_rules r
     JOIN accounts a ON a.id = r.account_id
     WHERE r.active = 1 AND r.type = 'expense' AND a.currency = ?
       AND r.next_run_date > ? AND r.next_run_date <= ?`,
    [currency, today, monthEnd]
  );
  return (emis?.total ?? 0) + (bills?.total ?? 0);
}

export interface DailyGoalStreakPoint {
  date: string;
  streakDays: number;
}

/**
 * For each of the last `days` days (ending `today`): the under-goal streak length ending that day. Looks back
 * past the visible window so streaks continue rather than reset to 1; zero-expense days count as under goal.
 */
export async function getDailyGoalStreakSeries(
  goalMinor: number,
  days = 5,
  today: string = toIso(new Date())
): Promise<DailyGoalStreakPoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  // Floor the lookback at the first expense/default-currency transaction (as getDailyExpenseTotals below);
  // otherwise empty pre-install days read as "under goal" and a new user sees a decades-long streak.
  const earliestRow = await db.getFirstAsync<{ earliest: string | null }>(
    `SELECT MIN(t.date) as earliest FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'expense' AND a.currency = ?`,
    [currency]
  );
  const earliestTxDate = earliestRow?.earliest ?? today;
  const lookbackDays = days + 55;
  const computedStart = addDaysToIsoDate(today, -(lookbackDays - 1));
  const start = computedStart > earliestTxDate ? computedStart : earliestTxDate;

  const totals = await getDailyExpenseTotals({ start, end: today });
  const totalByDate = new Map(totals.map((t) => [t.date, t.totalMinor]));
  const historyDates = isoDatesInRange(start, today);
  const underGoal = historyDates.map((d) => (totalByDate.get(d) ?? 0) <= goalMinor);
  const series = streakSeries(underGoal);
  const streakByDate = new Map(historyDates.map((d, i) => [d, series[i]]));

  const visibleDates = isoDatesInRange(addDaysToIsoDate(today, -(days - 1)), today);
  return visibleDates.map((date) => ({ date, streakDays: streakByDate.get(date) ?? 0 }));
}

/**
 * A category's average monthly expense over the last `months` full months (current partial month excluded),
 * for the what-if sandbox. Reuses getPeriodSummary's category-breakdown query.
 */
export async function getCategoryMonthlyAverages(
  months = 3,
  reference: Date = new Date()
): Promise<CategoryBreakdownItem[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const end = toIso(new Date(reference.getFullYear(), reference.getMonth(), 0)); // last day of the previous month
  const start = toIso(new Date(reference.getFullYear(), reference.getMonth() - months, 1));

  // Divide by months that actually have expense history, not the window size: one real month over a
  // 3-month window reads as a third of the truth. Same type/currency scoping as getPeriodSummary.
  const earliestRow = await db.getFirstAsync<{ earliest: string | null }>(
    `SELECT MIN(t.date) as earliest FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'expense' AND a.currency = ? AND t.date >= ? AND t.date <= ?`,
    [currency, start, end]
  );
  const { categoryBreakdown } = await getPeriodSummary({ start, end });
  const earliestExpenseDate = earliestRow?.earliest ?? start;
  const actualMonths = Math.min(months, Math.max(1, monthsBetweenIsoDates(earliestExpenseDate, end) + 1));
  return categoryBreakdown.map((c) => ({ ...c, totalMinor: Math.round(c.totalMinor / actualMonths) }));
}

export interface PeriodComparison {
  period: ReportPeriod;
  current: PeriodSummary;
  previous: PeriodSummary;
  incomeChangePct: number | null;
  expenseChangePct: number | null;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // undefined growth from zero base
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * The category whose spend grew most (>20%) vs its prior-period total. Pure over fetched breakdowns (no query);
 * categories with no prior-period spend are skipped (nothing to compare).
 */
export function findTopGrowingCategory(
  current: CategoryBreakdownItem[],
  previous: CategoryBreakdownItem[]
): { categoryId: string; name: string; pctChange: number } | null {
  let best: { categoryId: string; name: string; pctChange: number } | null = null;
  for (const cat of current) {
    const prevTotal = previous.find((p) => p.categoryId === cat.categoryId)?.totalMinor ?? 0;
    if (prevTotal === 0) continue;
    const pctChange = ((cat.totalMinor - prevTotal) / prevTotal) * 100;
    if (pctChange > 20 && (!best || pctChange > best.pctChange)) {
      best = { categoryId: cat.categoryId, name: cat.name, pctChange };
    }
  }
  return best;
}

export async function getPeriodComparison(
  period: ReportPeriod,
  reference: Date = new Date()
): Promise<PeriodComparison> {
  const { current, previous } = getPeriodRanges(period, reference);
  return getRangeComparison(current, previous, period);
}

/**
 * The same comparison against two explicit ranges, for the period navigator (any past month or year,
 * not only the one containing today).
 */
export async function getRangeComparison(
  current: DateRange,
  previous: DateRange,
  period: ReportPeriod = 'month'
): Promise<PeriodComparison> {
  const [curSummary, prevSummary] = await Promise.all([
    getPeriodSummary(current),
    getPeriodSummary(previous),
  ]);
  return {
    period,
    current: curSummary,
    previous: prevSummary,
    incomeChangePct: pctChange(curSummary.incomeMinor, prevSummary.incomeMinor),
    expenseChangePct: pctChange(curSummary.expenseMinor, prevSummary.expenseMinor),
  };
}

export interface TrendPoint {
  label: string;
  totalMinor: number;
}

/** Total expense per calendar month for the last `months` months (oldest first) — one grouped query, not N. */
export async function getMonthlyExpenseTrend(
  months = 6,
  reference: Date = new Date(),
  excludeSensitive = false
): Promise<TrendPoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const start = new Date(reference.getFullYear(), reference.getMonth() - (months - 1), 1);
  const startIso = toIso(start);

  const rows = await db.getAllAsync<{ ym: string; total: number }>(
    `SELECT strftime('%Y-%m', t.date) as ym, SUM(${SPEND_AMOUNT}) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date >= ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}
     GROUP BY ym`,
    [currency, startIso]
  );
  const byMonth = new Map(rows.map((r) => [r.ym, Math.max(0, r.total)]));

  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    points.push({
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      totalMinor: byMonth.get(ym) ?? 0,
    });
  }
  return points;
}

/** The last `months` calendar months ending at `reference`'s, oldest first, with the `YYYY-MM` key and short label. */
function monthSlots(months: number, reference: Date): { ym: string; label: string }[] {
  const slots: { ym: string; label: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    slots.push({
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
    });
  }
  return slots;
}

export interface CashFlowPoint {
  label: string;
  incomeMinor: number;
  expenseMinor: number;
}

/** Income and spending per calendar month for the last `months` months (oldest first), same rules as getPeriodSummary. */
export async function getMonthlyCashFlow(
  months = 7,
  reference: Date = new Date(),
  excludeSensitive = false
): Promise<CashFlowPoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const startIso = toIso(new Date(reference.getFullYear(), reference.getMonth() - (months - 1), 1));

  const rows = await db.getAllAsync<{ ym: string; income: number; expense: number }>(
    `SELECT strftime('%Y-%m', t.date) as ym,
       SUM(CASE WHEN ${INCOME_ROWS} THEN t.amount_minor ELSE 0 END) as income,
       SUM(CASE WHEN ${SPEND_ROWS} THEN ${SPEND_AMOUNT} ELSE 0 END) as expense
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE (${INCOME_ROWS} OR ${SPEND_ROWS}) AND a.currency = ? AND t.date >= ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}
     GROUP BY ym`,
    [currency, startIso]
  );
  const byMonth = new Map(rows.map((r) => [r.ym, r]));
  return monthSlots(months, reference).map(({ ym, label }) => ({
    label,
    incomeMinor: byMonth.get(ym)?.income ?? 0,
    expenseMinor: Math.max(0, byMonth.get(ym)?.expense ?? 0),
  }));
}

export interface CategoryTrack {
  categoryId: string;
  name: string;
  color: string;
  /** Spending per calendar month, oldest first; one entry for each of the months asked for. */
  totalsMinor: number[];
}

/** Spending per top-level category per month for the last `months` months, rolled up like getPeriodSummary's breakdown. */
export async function getCategoryMonthlyTotals(
  months = 7,
  reference: Date = new Date(),
  excludeSensitive = false
): Promise<CategoryTrack[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const startIso = toIso(new Date(reference.getFullYear(), reference.getMonth() - (months - 1), 1));

  const rows = await db.getAllAsync<{
    categoryId: string;
    name: string;
    color: string;
    ym: string;
    total: number;
  }>(
    `SELECT top.id as categoryId, top.name as name, top.color as color,
       strftime('%Y-%m', t.date) as ym, SUM(${SPEND_AMOUNT}) as total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN categories top ON top.id = COALESCE(c.parent_id, c.id)
     JOIN accounts a ON a.id = t.account_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date >= ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}
     GROUP BY top.id, ym`,
    [currency, startIso]
  );
  const slots = monthSlots(months, reference);
  const slotOf = new Map(slots.map((s, i) => [s.ym, i]));
  const tracks = new Map<string, CategoryTrack>();
  for (const r of rows) {
    const at = slotOf.get(r.ym);
    if (at === undefined) continue;
    let track = tracks.get(r.categoryId);
    if (!track) {
      track = {
        categoryId: r.categoryId,
        name: r.name,
        color: r.color,
        totalsMinor: new Array<number>(months).fill(0),
      };
      tracks.set(r.categoryId, track);
    }
    track.totalsMinor[at] = Math.max(0, r.total);
  }
  return [...tracks.values()].filter((t) => t.totalsMinor.some((v) => v > 0));
}

export interface NetWorthPoint {
  label: string;
  netWorthMinor: number;
}

/**
 * A borrowed loan's outstanding balance is a liability (subtracted from net worth); a lent loan's is an asset
 * (added). Pure so the sign logic in getNetWorthTrend is testable without a database.
 */
export function loanNetWorthContribution(
  direction: 'borrowed' | 'lent',
  principalMinor: number,
  paidPrincipalMinor: number,
  /**
   * Tracked value of what a *borrowed* loan financed (home, vehicle); 0 = count the full outstanding debt.
   * When set, the contribution is net equity (asset − owed). Never applied to `lent` loans: just a receivable.
   */
  assetValueMinor = 0
): number {
  const outstanding = Math.max(0, principalMinor - paidPrincipalMinor);
  if (direction === 'lent') return outstanding;
  return assetValueMinor - outstanding;
}

/**
 * "Tracked Balance" (Home and Profile headline), shared so they can't drift: default-currency account balances
 * + non-closed loans' loanNetWorthContribution + net friends balance. A defaulted loan counts; 'closed' drops.
 */
export function computeTrackedBalance(input: TrackedBalanceInput): number {
  const parts = trackedBalanceParts(input);
  return parts.accountsMinor + parts.loansMinor + parts.peopleMinor;
}

export interface TrackedBalanceInput {
  accounts: { currency: string; currentBalanceMinor: number }[];
  loans: {
    direction: 'borrowed' | 'lent';
    status: 'active' | 'closed' | 'defaulted';
    outstandingPrincipalMinor: number;
    assetValueMinor: number | null;
  }[];
  people: { balanceMinor: number }[];
  defaultCurrency: string;
}

export interface TrackedBalanceParts {
  /** Default-currency account balances. */
  accountsMinor: number;
  /** Every not-yet-closed loan's net-worth contribution (loanNetWorthContribution). */
  loansMinor: number;
  /** The net of every friends-and-family balance. */
  peopleMinor: number;
}

/** The three terms computeTrackedBalance adds up — Profile shows them as a sum. */
export function trackedBalanceParts(input: TrackedBalanceInput): TrackedBalanceParts {
  return {
    accountsMinor: input.accounts
      .filter((a) => a.currency === input.defaultCurrency)
      .reduce((sum, a) => sum + a.currentBalanceMinor, 0),
    loansMinor: input.loans
      .filter((l) => l.status !== 'closed')
      .reduce(
        (sum, l) =>
          sum + loanNetWorthContribution(l.direction, l.outstandingPrincipalMinor, 0, l.assetValueMinor ?? 0),
        0
      ),
    peopleMinor: input.people.reduce((sum, p) => sum + p.balanceMinor, 0),
  };
}

/**
 * Net worth at each of the last `months` month-ends (latest = `reference`), cut off at that date. Transfers
 * between two counted accounts net to zero, so accounts need only income/expense; a transfer to or from an
 * archived or other-currency account is an approximation (its counted side isn't offset). A paid installment
 * with no `paid_date` is dated by its `due_date`.
 */
export async function getNetWorthTrend(months = 6, reference: Date = new Date()): Promise<NetWorthPoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const points: NetWorthPoint[] = [];

  const cutoffs = Array.from({ length: months }, (_, k) => {
    const i = months - 1 - k;
    return i === 0 ? reference : new Date(reference.getFullYear(), reference.getMonth() - i + 1, 0);
  });

  // One grouped pass over the ledger, not one full re-sum per month. Archived accounts are excluded to match
  // listAccounts()'s default, else they'd count toward Net Worth after vanishing from the Accounts tab's total.
  const monthlyNet = await db.getAllAsync<{ ym: string; net: number }>(
    `SELECT substr(t.date, 1, 7) AS ym,
       SUM(CASE t.type WHEN 'income' THEN t.amount_minor WHEN 'expense' THEN -t.amount_minor ELSE 0 END) AS net
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.currency = ? AND a.archived = 0 AND t.date <= ?
     GROUP BY ym`,
    [currency, toIso(reference)]
  );
  const openingRow = await db.getFirstAsync<{ total: number | null }>(
    'SELECT COALESCE(SUM(opening_balance_minor), 0) AS total FROM accounts WHERE currency = ? AND archived = 0',
    [currency]
  );

  for (let k = 0; k < months; k++) {
    const isCurrentMonth = k === months - 1;
    const cutoff = cutoffs[k];
    const cutoffIso = toIso(cutoff);
    const cutoffMonth = cutoffIso.slice(0, 7);

    let ledgerNet = 0;
    for (const row of monthlyNet) if (row.ym <= cutoffMonth) ledgerNet += row.net;
    const valuationRow = await db.getFirstAsync<{ total: number | null }>(
      `SELECT COALESCE(SUM(${valuationAdjSql('a', true)}), 0) AS total FROM accounts a
       WHERE a.tracked = 1 AND a.currency = ? AND a.archived = 0`,
      [cutoffIso, currency]
    );
    const accountsMinor = (openingRow?.total ?? 0) + ledgerNet + (valuationRow?.total ?? 0);

    const loanRows = await db.getAllAsync<{
      direction: string;
      principal_minor: number;
      paid_principal: number | null;
      asset_value_minor: number | null;
    }>(
      // A prepayment reduces principal but isn't a loan_payments row; without the second SUM its cash left
      // the accounts total while the debt never dropped (phantom debt forever).
      `SELECT l.direction as direction, l.principal_minor as principal_minor, l.asset_value_minor as asset_value_minor,
         (SELECT COALESCE(SUM(lp.principal_component_minor), 0) FROM loan_payments lp
           WHERE lp.loan_id = l.id AND lp.status = 'paid' AND COALESCE(lp.paid_date, lp.due_date) <= ?) +
         (SELECT COALESCE(SUM(pt.amount_minor), 0) FROM transactions pt
           WHERE pt.loan_id = l.id AND pt.loan_tx_kind = 'prepayment' AND pt.date <= ?) as paid_principal
       FROM loans l
       WHERE l.start_date <= ?`,
      [cutoffIso, cutoffIso, cutoffIso]
    );
    let loansNet = 0;
    for (const row of loanRows) {
      loansNet += loanNetWorthContribution(
        row.direction as 'borrowed' | 'lent',
        row.principal_minor,
        row.paid_principal ?? 0,
        row.asset_value_minor ?? 0
      );
    }

    const peopleRow = await db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(amount_minor) as total FROM person_ledger_entries WHERE date <= ?`,
      [cutoffIso]
    );

    const netWorthMinor = accountsMinor + loansNet + (peopleRow?.total ?? 0);
    points.push({
      label: isCurrentMonth ? 'Now' : cutoff.toLocaleDateString(undefined, { month: 'short' }),
      netWorthMinor,
    });
  }
  return points;
}
