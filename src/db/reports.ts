import { getDb } from './client';
import { toLocalIsoDate } from '@/lib/date';
import { getDefaultCurrency } from './settings';

export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

export interface DateRange {
  start: string; // inclusive, YYYY-MM-DD
  end: string; // inclusive, YYYY-MM-DD
}

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
}

export interface PeriodSummary {
  incomeMinor: number;
  expenseMinor: number;
  // income - expense - savingsContributionMinor: money already moved into
  // savings this period no longer counts as "surplus" — it's been acted on,
  // not left sitting free to allocate. Withdrawing from savings does the
  // reverse (savingsContributionMinor goes negative, adding back to net).
  netMinor: number;
  savingsContributionMinor: number; // net money moved into savings-type accounts
  categoryBreakdown: CategoryBreakdownItem[];
}

/**
 * Every aggregate query here joins to `accounts` and filters to the
 * default currency — transactions carry no currency of their own (only the
 * account they moved through does), so summing across accounts in
 * different currencies would otherwise add face values together as if
 * 1 unit of one currency equalled 1 unit of another. Accounts in other
 * currencies still work individually; they're just excluded from these
 * combined totals rather than silently corrupting them.
 */
export async function getPeriodSummary(range: DateRange): Promise<PeriodSummary> {
  const db = await getDb();
  const currency = await getDefaultCurrency();

  const income = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(t.amount_minor) as total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'income' AND a.currency = ? AND t.date >= ? AND t.date <= ?`,
    [currency, range.start, range.end]
  );
  const expense = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(t.amount_minor) as total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'expense' AND a.currency = ? AND t.date >= ? AND t.date <= ?`,
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

  // Rolled up to the top-level category — a subcategory's own spend (e.g.
  // "Zomato") is folded into its parent's row ("Food & Dining") rather than
  // appearing as its own independent slice/bar. `hasSubcategories` tells the
  // caller whether this row can be drilled into via getSubcategoryBreakdown.
  const breakdown = await db.getAllAsync<any>(
    `SELECT top.id as categoryId, top.name as name, top.color as color, SUM(t.amount_minor) as total,
       EXISTS(SELECT 1 FROM categories ch WHERE ch.parent_id = top.id AND ch.archived = 0) as hasSubcategories,
       MAX(c.is_sensitive) as isSensitive
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN categories top ON top.id = COALESCE(c.parent_id, c.id)
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'expense' AND a.currency = ? AND t.date >= ? AND t.date <= ?
     GROUP BY top.id
     ORDER BY total DESC`,
    [currency, range.start, range.end]
  );

  const savingsContributionMinor = (savingsIn?.total ?? 0) - (savingsOut?.total ?? 0);
  return {
    incomeMinor: income?.total ?? 0,
    expenseMinor: expense?.total ?? 0,
    netMinor: (income?.total ?? 0) - (expense?.total ?? 0) - savingsContributionMinor,
    savingsContributionMinor,
    categoryBreakdown: breakdown.map((r) => ({
      categoryId: r.categoryId,
      name: r.name,
      color: r.color,
      totalMinor: r.total,
      hasSubcategories: !!r.hasSubcategories,
      isSensitive: !!r.isSensitive,
    })),
  };
}

/**
 * The split behind one rolled-up category row — one entry per subcategory,
 * plus an "Other <name>" entry for spend tagged directly against the parent
 * itself rather than any specific subcategory (a real case: someone picks
 * "Food & Dining" itself for a one-off purchase that doesn't fit "Zomato" or
 * "Bistro Central"). Powers the drill-down when `hasSubcategories` is true.
 */
export async function getSubcategoryBreakdown(
  parentCategoryId: string,
  range: DateRange
): Promise<CategoryBreakdownItem[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const parent = await db.getFirstAsync<{ name: string; color: string }>(
    'SELECT name, color FROM categories WHERE id = ?',
    [parentCategoryId]
  );
  const rows = await db.getAllAsync<any>(
    `SELECT c.id as categoryId, c.name as name, c.color as color, SUM(t.amount_minor) as total, c.is_sensitive as isSensitive
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'expense' AND a.currency = ? AND t.date >= ? AND t.date <= ?
       AND (c.id = ? OR c.parent_id = ?)
     GROUP BY c.id
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
  }));
}

export interface DailyExpensePoint {
  date: string; // YYYY-MM-DD
  totalMinor: number;
}

/** Total expense for each day that had spending within `range` — one grouped query. */
export async function getDailyExpenseTotals(range: DateRange): Promise<DailyExpensePoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const rows = await db.getAllAsync<{ date: string; total: number }>(
    `SELECT t.date as date, SUM(t.amount_minor) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'expense' AND a.currency = ? AND t.date >= ? AND t.date <= ?
     GROUP BY t.date`,
    [currency, range.start, range.end]
  );
  return rows.map((r) => ({ date: r.date, totalMinor: r.total }));
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
 * The category whose spend grew the most (>20%) vs the same category's
 * total in the prior period — a pure function over already-fetched
 * breakdowns, no extra query. Categories with no prior-period spend are
 * skipped (nothing to compare growth against).
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
 * The same comparison against two explicit ranges — used by the period
 * navigator, where the user can be looking at any past month or year rather
 * than only the one containing today.
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
  reference: Date = new Date()
): Promise<TrendPoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const start = new Date(reference.getFullYear(), reference.getMonth() - (months - 1), 1);
  const startIso = toIso(start);

  const rows = await db.getAllAsync<{ ym: string; total: number }>(
    `SELECT strftime('%Y-%m', t.date) as ym, SUM(t.amount_minor) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'expense' AND a.currency = ? AND t.date >= ?
     GROUP BY ym`,
    [currency, startIso]
  );
  const byMonth = new Map(rows.map((r) => [r.ym, r.total]));

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

export interface IncomeExpensePoint {
  label: string;
  incomeMinor: number;
  expenseMinor: number;
}

/** Income and expense per calendar month for the last `months` months (oldest first) — one grouped query for each. */
export async function getIncomeExpenseTrend(
  months = 6,
  reference: Date = new Date()
): Promise<IncomeExpensePoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const start = new Date(reference.getFullYear(), reference.getMonth() - (months - 1), 1);
  const startIso = toIso(start);

  const rows = await db.getAllAsync<{ ym: string; type: string; total: number }>(
    `SELECT strftime('%Y-%m', t.date) as ym, t.type as type, SUM(t.amount_minor) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type IN ('income', 'expense') AND a.currency = ? AND t.date >= ?
     GROUP BY ym, t.type`,
    [currency, startIso]
  );
  const income = new Map(rows.filter((r) => r.type === 'income').map((r) => [r.ym, r.total]));
  const expense = new Map(rows.filter((r) => r.type === 'expense').map((r) => [r.ym, r.total]));

  const points: IncomeExpensePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    points.push({
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      incomeMinor: income.get(ym) ?? 0,
      expenseMinor: expense.get(ym) ?? 0,
    });
  }
  return points;
}

export interface NetWorthPoint {
  label: string;
  netWorthMinor: number;
}

/**
 * A borrowed loan's outstanding balance is a liability (subtracted from net
 * worth); a lent loan's outstanding balance is an asset owed to you (added).
 * Pulled out as a pure function so the sign logic in getNetWorthTrend has
 * direct test coverage without needing a live database.
 */
export function loanNetWorthContribution(
  direction: 'borrowed' | 'lent',
  principalMinor: number,
  paidPrincipalMinor: number,
  /**
   * The tracked current value of whatever a *borrowed* loan financed (a
   * home, a vehicle) — 0 by default, which reproduces the original
   * behavior exactly (a borrowed loan always net-worth-negative by its full
   * outstanding balance) for anyone who hasn't recorded one. Once set, the
   * loan's own contribution becomes its real net equity (asset value minus
   * what's still owed) instead of counting the debt with no offsetting
   * asset — the "why is my net worth deeply negative for a completely
   * normal home loan" complaint this fixes. Never applied to a `lent` loan:
   * lending money doesn't leave you holding an asset, just a receivable.
   */
  assetValueMinor = 0
): number {
  const outstanding = Math.max(0, principalMinor - paidPrincipalMinor);
  if (direction === 'lent') return outstanding;
  return assetValueMinor - outstanding;
}

/**
 * "Tracked Balance" — the single headline figure Home and Profile both show:
 * default-currency account balances + every not-yet-closed loan's net-worth
 * contribution (asset-value aware, via loanNetWorthContribution) + the net of
 * every friends-and-family balance.
 *
 * Extracted here so the two screens can never drift: Home previously used a
 * hand-rolled `-outstandingPrincipalMinor` that ignored a loan's tracked
 * asset value, while Profile already routed through loanNetWorthContribution,
 * so the same data could show two different numbers on the two screens.
 * A defaulted loan still counts (money is still owed either way); only a
 * fully 'closed' loan drops out.
 */
export function computeTrackedBalance(input: {
  accounts: { currency: string; currentBalanceMinor: number }[];
  loans: {
    direction: 'borrowed' | 'lent';
    status: 'active' | 'closed' | 'defaulted';
    outstandingPrincipalMinor: number;
    assetValueMinor: number | null;
  }[];
  people: { balanceMinor: number }[];
  defaultCurrency: string;
}): number {
  const accountsTotal = input.accounts
    .filter((a) => a.currency === input.defaultCurrency)
    .reduce((sum, a) => sum + a.currentBalanceMinor, 0);
  const loansNet = input.loans
    .filter((l) => l.status !== 'closed')
    .reduce(
      (sum, l) =>
        sum + loanNetWorthContribution(l.direction, l.outstandingPrincipalMinor, 0, l.assetValueMinor ?? 0),
      0
    );
  const peopleNet = input.people.reduce((sum, p) => sum + p.balanceMinor, 0);
  return accountsTotal + loansNet + peopleNet;
}

/**
 * Net worth reconstructed as of the end of each of the last `months`
 * months (the most recent point uses `reference` itself, since future
 * transactions obviously can't exist yet) — accounts + receivable loans -
 * outstanding loans + people balances, all filtered to that cutoff date
 * rather than read from current totals. Transfers between your own accounts
 * net to zero across the whole account set, so the account total only needs
 * income/expense effects, not a per-account transfer trace.
 *
 * For a loan's installments paid before it was entered into Yume
 * (`alreadyPaidInstallments`, which have no real `paid_date`), the
 * installment's `due_date` is used as the best available stand-in for when
 * it was actually paid — historical dates for those simply aren't known.
 */
export async function getNetWorthTrend(months = 6, reference: Date = new Date()): Promise<NetWorthPoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const points: NetWorthPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const isCurrentMonth = i === 0;
    const cutoff = isCurrentMonth
      ? reference
      : new Date(reference.getFullYear(), reference.getMonth() - i + 1, 0); // last day of that month
    const cutoffIso = toIso(cutoff);

    // Archived accounts are excluded here to match listAccounts()'s default
    // (used for every other on-screen balance/total) — without this filter,
    // an archived account's balance kept counting toward Net Worth even
    // after it had already disappeared from the Accounts tab's own total.
    const accountsRow = await db.getFirstAsync<{ total: number | null }>(
      `SELECT
         (SELECT COALESCE(SUM(opening_balance_minor), 0) FROM accounts WHERE currency = ? AND archived = 0) +
         COALESCE((SELECT SUM(t.amount_minor) FROM transactions t JOIN accounts a ON a.id = t.account_id
           WHERE t.type = 'income' AND a.currency = ? AND a.archived = 0 AND t.date <= ?), 0) -
         COALESCE((SELECT SUM(t.amount_minor) FROM transactions t JOIN accounts a ON a.id = t.account_id
           WHERE t.type = 'expense' AND a.currency = ? AND a.archived = 0 AND t.date <= ?), 0)
         as total`,
      [currency, currency, cutoffIso, currency, cutoffIso]
    );

    const loanRows = await db.getAllAsync<{
      direction: string;
      principal_minor: number;
      paid_principal: number | null;
      asset_value_minor: number | null;
    }>(
      `SELECT l.direction as direction, l.principal_minor as principal_minor, l.asset_value_minor as asset_value_minor,
         (SELECT COALESCE(SUM(lp.principal_component_minor), 0) FROM loan_payments lp
           WHERE lp.loan_id = l.id AND lp.status = 'paid' AND COALESCE(lp.paid_date, lp.due_date) <= ?) as paid_principal
       FROM loans l
       WHERE l.start_date <= ?`,
      [cutoffIso, cutoffIso]
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

    const netWorthMinor = (accountsRow?.total ?? 0) + loansNet + (peopleRow?.total ?? 0);
    points.push({
      label: isCurrentMonth ? 'Now' : cutoff.toLocaleDateString(undefined, { month: 'short' }),
      netWorthMinor,
    });
  }
  return points;
}
