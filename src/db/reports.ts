import { getDb } from './client';
import {
  toLocalIsoDate,
  addDaysToIsoDate,
  isoDatesInRange,
  monthsBetweenIsoDates,
  dayOfIsoDate,
} from '@/lib/date';
import { runsBetween } from '@/lib/recurrence';
import { cachedRead } from './readCache';
import { streakSeries } from '@/lib/gardenGrowth';
import { getDefaultCurrency } from './settings';
import type { Account, DateRange, RecurrenceFrequency } from '@/types';
import { SPEND_ROWS, SPEND_AMOUNT, NOT_SENSITIVE, rowsOf, amountOf, countOf, sensitiveOf } from './spendSql';

import {
  getPeriodSummary,
  getPeriodRanges,
  type CategoryBreakdownItem,
  type PeriodSummary,
} from './reportsCore';

// The period summaries and the trend series live in their own files; everything is still exported from here.
export * from './reportsCore';
export * from './reportTrends';

type ReportPeriod = 'day' | 'week' | 'month' | 'year';

const toIso = toLocalIsoDate;

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
       ${countOf(kind)} as count, ${sensitiveOf('c')} as isSensitive
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
       SUM(${amountOf(kind)}) as total, MAX(${sensitiveOf('c')}) as isSensitive
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
 * Net reports deduct refunds; outgoing daily trackers count purchases without refilling the daily allowance.
 */
export async function getDailyExpenseTotals(
  range: DateRange,
  excludeSensitive = false,
  categoryId?: string,
  basis: 'net' | 'outgoing' = 'net'
): Promise<DailyExpensePoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const rows = await db.getAllAsync<{ date: string; total: number }>(
    `SELECT t.date as date, SUM(${basis === 'outgoing' ? 't.amount_minor' : SPEND_AMOUNT}) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE ${basis === 'outgoing' ? "t.type = 'expense'" : SPEND_ROWS} AND a.currency = ? AND t.date >= ? AND t.date <= ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}${
       categoryId
         ? ` AND (t.category_id = ? OR t.category_id IN (SELECT id FROM categories WHERE parent_id = ?))`
         : ''
     }
     GROUP BY t.date`,
    categoryId
      ? [currency, range.start, range.end, categoryId, categoryId]
      : [currency, range.start, range.end]
  );
  // Net refunds can exceed purchases; never plot negative spending.
  return rows
    .map((r) => ({ date: r.date, totalMinor: Math.max(0, r.total) }))
    .filter((r) => r.totalMinor > 0);
}

/**
 * Today's total spend, scoped like every other spend figure (expense-type, default-currency accounts) but for
 * one day. Refunds do not refill the daily allowance. Powers Home and Garden daily progress.
 */
export async function getTodaySpend(
  today: string = toIso(new Date()),
  excludeSensitive = false
): Promise<number> {
  const totals = await getDailyExpenseTotals(
    { start: today, end: today },
    excludeSensitive,
    undefined,
    'outgoing'
  );
  return totals[0]?.totalMinor ?? 0;
}

/**
 * What went out today by choice: spending typed in by hand, net of refunds, without the system categories (Loan EMI,
 * fees, Friends & Family) and without entries a repeating rule posted. Those are bills Home already set aside in what
 * is free, so counting them against the daily figure would call a bill day an overspend.
 */
export async function getTodayEverydaySpend(
  today: string = toIso(new Date()),
  excludeSensitive = false
): Promise<number> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(${SPEND_AMOUNT}) AS total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND IFNULL(c.is_system, 0) = 0 AND t.rule_id IS NULL
       AND t.date = ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}`,
    [currency, today]
  );
  return Math.max(0, row?.total ?? 0);
}

/**
 * Home's forecast inputs (lib/pace.ts): everyday spend 1st→`today` (excl. Loan EMI, fees, Friends & Family)
 * plus still-due this month: unpaid non-closed borrowed-loan EMIs and active recurring expenses. Default currency only.
 */
export async function getMonthPaceInputs(
  today: string = toIso(new Date()),
  excludeSensitive = false
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
       AND t.date >= ? AND t.date <= ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}`,
    [currency, monthStart, today]
  );
  const emis = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(p.emi_amount_minor) AS total FROM loan_payments p
     JOIN loans l ON l.id = p.loan_id
     WHERE p.status IN ('pending', 'overdue') AND l.status != 'closed' AND l.direction = 'borrowed'
       AND p.due_date > ? AND p.due_date <= ?`,
    [today, monthEnd]
  );
  return {
    everydaySpentMinor: Math.max(0, everyday?.total ?? 0),
    dueRestOfMonthMinor: (emis?.total ?? 0) + (await recurringExpensesDue(today, monthEnd, excludeSensitive)),
  };
}

/**
 * What active repeating expenses (default currency) will still post after `today` through `monthEnd`, every
 * run counted: a weekly bill due four more times this month counts four times.
 */
async function recurringExpensesDue(
  today: string,
  monthEnd: string,
  excludeSensitive = false
): Promise<number> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const rules = await db.getAllAsync<{
    amount_minor: number;
    next_amount_minor: number | null;
    scheduled_date: string | null;
    posting_mode: string;
    next_run_date: string;
    frequency: RecurrenceFrequency;
    interval_count: number;
    anchor_day: number | null;
    end_date: string | null;
  }>(
    `SELECT r.amount_minor, r.next_amount_minor, r.scheduled_date, r.posting_mode, r.next_run_date, r.frequency, r.interval_count, r.anchor_day, r.end_date
     FROM recurring_rules r
     JOIN accounts a ON a.id = r.account_id
     WHERE r.active = 1 AND r.type = 'expense' AND a.currency = ? AND r.next_run_date <= ?${
       // A hidden category's repeating payment stays out, like its entries do.
       excludeSensitive
         ? ` AND COALESCE((SELECT ${sensitiveOf('sc')} FROM categories sc WHERE sc.id = r.category_id), 0) = 0`
         : ''
     }`,
    [currency, monthEnd]
  );
  return rules.reduce(
    (sum, r) =>
      sum +
      r.amount_minor *
        runsBetween(
          {
            nextRunDate: r.next_run_date,
            scheduledDate: r.scheduled_date,
            frequency: r.frequency,
            intervalCount: r.interval_count,
            anchorDay: r.anchor_day ?? dayOfIsoDate(r.next_run_date),
            endDate: r.end_date,
          },
          today,
          monthEnd
        ) +
      (r.posting_mode === 'confirm' &&
      r.next_run_date <= today &&
      (!r.end_date || r.next_run_date <= r.end_date)
        ? (r.next_amount_minor ?? r.amount_minor)
        : 0) +
      (r.next_run_date > today &&
      r.next_run_date <= monthEnd &&
      (!r.end_date || r.next_run_date <= r.end_date)
        ? (r.next_amount_minor ?? r.amount_minor) - r.amount_minor
        : 0),
    0
  );
}

/**
 * Still owed through this month: unpaid EMIs through month end, including older arrears, and active recurring
 * expenses after `today`. Earlier recurring occurrences have already posted. Default currency.
 */
export async function getStillToPayThisMonth(
  today: string = toIso(new Date()),
  excludeSensitive = false
): Promise<number> {
  const db = await getDb();
  const [y, m] = today.split('-').map(Number);
  const monthEnd = `${today.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const emis = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(p.emi_amount_minor) AS total FROM loan_payments p
     JOIN loans l ON l.id = p.loan_id
     WHERE p.status IN ('pending', 'overdue') AND l.status != 'closed' AND l.direction = 'borrowed'
       AND p.due_date <= ?`,
    [monthEnd]
  );
  return (emis?.total ?? 0) + (await recurringExpensesDue(today, monthEnd, excludeSensitive));
}

export interface DailyGoalStreakPoint {
  date: string;
  streakDays: number;
  /** False before the first expense: there was nothing to keep under the goal yet. */
  tracked?: boolean;
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

  const totals = await getDailyExpenseTotals({ start, end: today }, false, undefined, 'outgoing');
  const totalByDate = new Map(totals.map((t) => [t.date, t.totalMinor]));
  const historyDates = isoDatesInRange(start, today);
  const underGoal = historyDates.map((d) => (totalByDate.get(d) ?? 0) <= goalMinor);
  const series = streakSeries(underGoal);
  const streakByDate = new Map(historyDates.map((d, i) => [d, series[i]]));

  const visibleDates = isoDatesInRange(addDaysToIsoDate(today, -(days - 1)), today);
  return visibleDates.map((date) => ({
    date,
    streakDays: streakByDate.get(date) ?? 0,
    tracked: date >= start,
  }));
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

/**
 * This month so far against the same days of last month (all of it, when last month was shorter): the fair
 * comparison while a month is in progress, since this month's first days set against all of last month always
 * look like "less".
 */
export function getMonthToDateRanges(reference: Date = new Date()): {
  current: DateRange;
  previous: DateRange;
} {
  const day = reference.getDate();
  const curStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const prevStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const prevMonthEnd = new Date(reference.getFullYear(), reference.getMonth(), 0);
  const prevSameDay = new Date(prevStart.getFullYear(), prevStart.getMonth(), day);
  return {
    current: { start: toIso(curStart), end: toIso(reference) },
    previous: {
      start: toIso(prevStart),
      end: toIso(prevSameDay > prevMonthEnd ? prevMonthEnd : prevSameDay),
    },
  };
}

/** What a month so far spent and earned against the same days of the month before. */
export function getMonthToDateComparison(reference: Date = new Date()): Promise<PeriodComparison> {
  const { current, previous } = getMonthToDateRanges(reference);
  return getRangeComparison(current, previous, 'month');
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
export function getRangeComparison(
  current: DateRange,
  previous: DateRange,
  period: ReportPeriod = 'month'
): Promise<PeriodComparison> {
  // Home, its Needs you list, the widgets and Activity all ask for this month's; computed once per change.
  return cachedRead(
    `rangeComparison:${current.start}:${current.end}:${previous.start}:${previous.end}:${period}`,
    () => readRangeComparison(current, previous, period)
  );
}

async function readRangeComparison(
  current: DateRange,
  previous: DateRange,
  period: ReportPeriod
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
