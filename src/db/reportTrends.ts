import { getDb } from './client';
import { toLocalIsoDate } from '@/lib/date';
import { getDefaultCurrency } from './settings';
import { valuationAdjSql } from './valuationSql';
import { SPEND_ROWS, SPEND_AMOUNT, INCOME_ROWS, NOT_SENSITIVE } from './spendSql';

const toIso = toLocalIsoDate;

export interface TrendPoint {
  label: string;
  totalMinor: number;
  /** Before tracking started and future slots are unavailable, rather than zero spending. */
  recorded?: boolean;
  month?: string;
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
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date >= ? AND t.date <= ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}
     GROUP BY ym`,
    [currency, startIso, toIso(new Date())]
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
  recorded?: boolean;
  month?: string;
}

/** Income and spending per calendar month for the last `months` months (oldest first), same rules as getPeriodSummary. */
export async function getMonthlyCashFlow(
  months = 7,
  reference: Date = new Date(),
  excludeSensitive = false
): Promise<CashFlowPoint[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const todayIso = toIso(new Date());

  const sensitive = excludeSensitive ? ` AND ${NOT_SENSITIVE}` : '';
  // Only the months shown are summed: reading the whole ledger for seven bars made this grow with every entry
  // (48 ms at 100,000 entries, in the Reports load). The first month with data, which marks the months before it as
  // not recorded, comes from its own cheap lookup of the earliest entry.
  const startIso = toIso(new Date(reference.getFullYear(), reference.getMonth() - (months - 1), 1));
  const rows = await db.getAllAsync<{ ym: string; income: number; expense: number }>(
    `SELECT strftime('%Y-%m', t.date) as ym,
       SUM(CASE WHEN ${INCOME_ROWS} THEN t.amount_minor ELSE 0 END) as income,
       SUM(CASE WHEN ${SPEND_ROWS} THEN ${SPEND_AMOUNT} ELSE 0 END) as expense
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE (${INCOME_ROWS} OR ${SPEND_ROWS}) AND a.currency = ? AND t.date >= ? AND t.date <= ?${sensitive}
     GROUP BY ym`,
    [currency, startIso, todayIso]
  );
  const earliest = await db.getFirstAsync<{ first: string | null }>(
    `SELECT MIN(t.date) AS first
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE (${INCOME_ROWS} OR ${SPEND_ROWS}) AND a.currency = ? AND t.date <= ?${sensitive}`,
    [currency, todayIso]
  );
  const byMonth = new Map(rows.map((r) => [r.ym, r]));
  const firstMonth = earliest?.first?.slice(0, 7);
  return monthSlots(months, reference).map(({ ym, label }) => ({
    label,
    month: ym,
    recorded: firstMonth != null && ym >= firstMonth && ym <= todayIso.slice(0, 7),
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
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date >= ? AND t.date <= ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}
     GROUP BY top.id, ym`,
    [currency, startIso, toIso(new Date())]
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
  month?: string;
  recorded?: boolean;
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
 * + loans' net-worth contribution + net friends balance. A closed loan has no debt/receivable, but the
 * tracked asset financed by a borrowed loan remains owned after repayment.
 */
export function computeTrackedBalance(input: TrackedBalanceInput): number {
  const parts = trackedBalanceParts(input);
  return parts.accountsMinor + parts.loansMinor + parts.peopleMinor;
}

interface TrackedBalanceInput {
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
  /** Loan equity/receivables, including tracked assets retained after a borrowed loan closes. */
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
    loansMinor: input.loans.reduce((sum, l) => {
      if (l.status === 'closed') return sum + (l.direction === 'borrowed' ? (l.assetValueMinor ?? 0) : 0);
      return (
        sum + loanNetWorthContribution(l.direction, l.outstandingPrincipalMinor, 0, l.assetValueMinor ?? 0)
      );
    }, 0),
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
    // The last point is "Now" only when the window ends in the month in progress; ending in a past month (Reports
    // on October, or on last year) it is that month, named like the rest.
    const today = new Date();
    const isCurrentMonth =
      k === months - 1 &&
      reference.getFullYear() === today.getFullYear() &&
      reference.getMonth() === today.getMonth();
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
      `SELECT SUM(e.amount_minor) as total FROM person_ledger_entries e
       LEFT JOIN transactions t ON t.id = e.transaction_id
       LEFT JOIN accounts a ON a.id = t.account_id
       WHERE e.date <= ? AND (e.transaction_id IS NULL OR a.currency = ?)`,
      [cutoffIso, currency]
    );

    const netWorthMinor = accountsMinor + loansNet + (peopleRow?.total ?? 0);
    points.push({
      label: isCurrentMonth ? 'Now' : cutoff.toLocaleDateString(undefined, { month: 'short' }),
      netWorthMinor,
    });
  }
  return points;
}

/**
 * Spending per calendar month ('YYYY-MM' → minor units, default currency), and the first month with any entry.
 * Feeds the period picker, which shows what each month cost and fades the months before your first entry.
 */
export async function getSpendByMonth(
  excludeSensitive = false
): Promise<{ byMonth: Map<string, number>; firstMonth: string | null }> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const rows = await db.getAllAsync<{ month: string; total: number }>(
    `SELECT substr(t.date, 1, 7) AS month,
            SUM(CASE WHEN ${SPEND_ROWS} THEN ${SPEND_AMOUNT} ELSE 0 END) AS total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.currency = ?${excludeSensitive ? ` AND ${NOT_SENSITIVE}` : ''}
     GROUP BY month
     ORDER BY month`,
    [currency]
  );
  return {
    // A month of refunds never shows as negative spending.
    byMonth: new Map(rows.map((r) => [r.month, Math.max(0, r.total)])),
    firstMonth: rows[0]?.month ?? null,
  };
}
