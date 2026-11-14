/**
 * A big ledger on real SQLite (20,000 entries over three years, seven accounts, loans, budgets, goals), in every normal
 * test run. It pins three things the screens depend on as a ledger grows: that figures still equal an independent
 * recomputation from the raw rows (so an optimisation cannot change a total), that each screen's load stays within
 * its number of database round-trips (on the phone every one waits its turn in a single queue, so a new query per
 * row, or per month, is felt), and that a load stays far inside a generous time (a lost index shows up as seconds).
 * The sharper timing, and 100,000-entry runs, are in loadPerf.test.ts (PERF=1).
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockRaw = createRealDataTestDb();
const mockStats = { calls: 0 };
const counted = <T>(fn: () => Promise<T>) => {
  mockStats.calls++;
  return fn();
};
const mockTestDb = {
  getFirstAsync: <T>(sql: string, p?: unknown[]) => counted(() => mockRaw.getFirstAsync<T>(sql, p)),
  getAllAsync: <T>(sql: string, p?: unknown[]) => counted(() => mockRaw.getAllAsync<T>(sql, p)),
  runAsync: (sql: string, p?: unknown[]) =>
    counted(() => mockRaw.runAsync(sql, p).finally(require('@/db/dataVersion').bumpDataVersion)),
  execAsync: (sql: string) =>
    counted(() => mockRaw.execAsync(sql).finally(require('@/db/dataVersion').bumpDataVersion)),
  withTransactionAsync: (fn: (tx: typeof mockRaw) => Promise<void>) =>
    counted(() => mockRaw.withTransactionAsync(fn).finally(require('@/db/dataVersion').bumpDataVersion)),
  exclusiveAsync: <T>(fn: (db: typeof mockRaw) => Promise<T>) => counted(() => fn(mockRaw)),
};
jest.mock('@/db/client', () => ({ ...jest.requireActual('@/db/client'), getDb: async () => mockTestDb }));
jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));

import { seedLedger } from './seedLedger';
import { trackDataVersion } from '@/db/dataVersion';
import { clearReadCache } from '@/db/readCache';
import { resetSettingsCache, setDefaultCurrency } from '@/db/settings';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans, getLoanProgress } from '@/db/loans';
import { listRecurringRules } from '@/db/recurring';
import { listCardCycles } from '@/db/cardCycles';
import { listBudgetsForMonth } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { listPeople } from '@/db/people';
import {
  getRangeComparison,
  getCarryInMinor,
  getTodaySpend,
  getMonthPaceInputs,
  getStillToPayThisMonth,
  getMonthlyExpenseTrend,
  getNetWorthTrend,
  getMonthlyCashFlow,
  getCategoryMonthlyTotals,
  getDailyExpenseTotals,
} from '@/db/reports';
import { getTidyUpReport } from '@/db/tidyUp';
import { loadNeedsYou } from '@/features/home/needsYouData';
import { loadReadyWraps } from '@/features/wrap/wrapWindow';
import { INCOME_ROWS, SPEND_AMOUNT, SPEND_ROWS } from '@/db/spendSql';
import { periodRange, previousPeriodRange, CURRENT_PERIOD } from '@/lib/period';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';

const ENTRIES = 20000;
const range = periodRange(CURRENT_PERIOD);

async function loadWithStats(load: () => Promise<unknown>) {
  clearReadCache();
  resetSettingsCache();
  await setDefaultCurrency('INR');
  mockStats.calls = 0;
  const start = performance.now();
  await load();
  return { ms: performance.now() - start, queries: mockStats.calls };
}

describe(`a ${ENTRIES.toLocaleString('en-US')}-entry ledger`, () => {
  jest.setTimeout(120000);
  beforeAll(async () => {
    await seedLedger(mockRaw, ENTRIES);
    trackDataVersion();
    // Statement compilation, once.
    await getMonthlyCashFlow(7, new Date(), false);
  });

  describe('figures equal a recomputation from the raw rows', () => {
    it('shows every entry the period has, newest day first', async () => {
      const rows = await listTransactions({ fromDate: range.start, toDate: range.end });
      const raw = await mockRaw.getAllAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM transactions WHERE date >= ? AND date <= ?`,
        [range.start, range.end]
      );
      expect(rows).toHaveLength(raw[0].n);
      const dates = rows.map((r) => r.date);
      expect([...dates].sort().reverse()).toEqual(dates);
    });

    it('adds up the period’s income and spending as the rows do', async () => {
      const cmp = await getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month');
      const [raw] = await mockRaw.getAllAsync<{ income: number; expense: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN ${INCOME_ROWS} THEN t.amount_minor ELSE 0 END), 0) AS income,
           COALESCE(SUM(CASE WHEN ${SPEND_ROWS} THEN ${SPEND_AMOUNT} ELSE 0 END), 0) AS expense
         FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE t.date >= ? AND t.date <= ? AND a.currency = 'INR'`,
        [range.start, range.end]
      );
      expect(cmp.current.incomeMinor).toBe(raw.income);
      expect(cmp.current.expenseMinor).toBe(raw.expense);
    });

    it.each([7, 12, 30])(
      'shows %i months of cash flow as a sum over the whole ledger gives it',
      async (months) => {
        const reference = new Date();
        for (const hide of [false, true]) {
          const flow = await getMonthlyCashFlow(months, reference, hide);
          const notSensitive = hide
            ? ` AND COALESCE((SELECT c.is_sensitive OR COALESCE((SELECT p.is_sensitive FROM categories p WHERE p.id = c.parent_id), 0) FROM categories c WHERE c.id = t.category_id), 0) = 0`
            : '';
          const todayIso = toLocalIsoDate(new Date());
          // The earlier version: every row of the ledger up to today, grouped by month.
          const all = await mockRaw.getAllAsync<{ ym: string; income: number; expense: number }>(
            `SELECT strftime('%Y-%m', t.date) AS ym,
             SUM(CASE WHEN ${INCOME_ROWS} THEN t.amount_minor ELSE 0 END) AS income,
             SUM(CASE WHEN ${SPEND_ROWS} THEN ${SPEND_AMOUNT} ELSE 0 END) AS expense
           FROM transactions t JOIN accounts a ON a.id = t.account_id
           WHERE (${INCOME_ROWS} OR ${SPEND_ROWS}) AND a.currency = 'INR' AND t.date <= ?${notSensitive}
           GROUP BY ym`,
            [todayIso]
          );
          const byMonth = new Map(all.map((r) => [r.ym, r]));
          const firstMonth = all.map((r) => r.ym).sort()[0];
          expect(flow).toHaveLength(months);
          for (const point of flow) {
            const row = byMonth.get(point.month!);
            expect(point.incomeMinor).toBe(row?.income ?? 0);
            expect(point.expenseMinor).toBe(Math.max(0, row?.expense ?? 0));
            expect(point.recorded).toBe(
              firstMonth != null && point.month! >= firstMonth && point.month! <= todayIso.slice(0, 7)
            );
          }
        }
      }
    );

    it('keeps every account’s balance equal to its opening balance plus what moved through it', async () => {
      const accounts = await listAccounts(true);
      for (const account of accounts.filter((a) => !a.investment && a.currency === 'INR')) {
        const [moved] = await mockRaw.getAllAsync<{ net: number }>(
          `SELECT COALESCE(SUM(CASE
               WHEN t.account_id = ? AND t.type = 'income' THEN t.amount_minor
               WHEN t.account_id = ? THEN -t.amount_minor
               WHEN t.to_account_id = ? THEN t.amount_minor
               ELSE 0 END), 0) AS net
           FROM transactions t WHERE t.account_id = ? OR t.to_account_id = ?`,
          [account.id, account.id, account.id, account.id, account.id]
        );
        expect(account.currentBalanceMinor).toBe(account.openingBalanceMinor + moved.net);
      }
    });

    it('is the same total whichever month of the last three years is asked for', async () => {
      const today = toLocalIsoDate(new Date());
      let from = addDaysToIsoDate(today, -365);
      let sum = 0;
      let raw = 0;
      for (let step = 0; step < 4; step++) {
        const to = addDaysToIsoDate(from, 90);
        const cmp = await getRangeComparison({ start: from, end: to }, { start: from, end: from }, 'month');
        sum += cmp.current.expenseMinor;
        const [r] = await mockRaw.getAllAsync<{ expense: number }>(
          `SELECT COALESCE(SUM(CASE WHEN ${SPEND_ROWS} THEN ${SPEND_AMOUNT} ELSE 0 END), 0) AS expense
           FROM transactions t JOIN accounts a ON a.id = t.account_id
           WHERE t.date >= ? AND t.date <= ? AND a.currency = 'INR'`,
          [from, to]
        );
        raw += r.expense;
        from = addDaysToIsoDate(to, 1);
      }
      expect(sum).toBe(raw);
    });
  });

  describe('each screen’s load stays within its round-trips and a generous time', () => {
    // Round-trips are exact and the same on every machine: a new one per row or per month shows here at once.
    // Times are ten or more times what a laptop takes, so a slow CI runner does not trip them; a lost index would.
    const loads: [string, () => Promise<unknown>, number, number][] = [
      [
        'Home',
        () =>
          Promise.all([
            listTransactions({ fromDate: range.start, toDate: range.end, limit: 6 }),
            getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month'),
            getCarryInMinor(range.start, false),
            listAccounts(),
            listCategories(),
            listLoans(),
            listRecurringRules(),
            getLoanProgress(),
            listCardCycles(),
            listBudgetsForMonth(undefined, false),
            listSavingsGoals(),
            getTodaySpend(undefined, false),
            getMonthPaceInputs(),
            getStillToPayThisMonth(),
            loadNeedsYou(),
            loadReadyWraps(),
          ]),
        60,
        2000,
      ],
      [
        'Activity (a month)',
        () =>
          Promise.all([
            listTransactions({ fromDate: range.start, toDate: range.end }),
            listAccounts(),
            listCategories(),
            getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month'),
          ]),
        18,
        1500,
      ],
      [
        'Reports (a month)',
        () =>
          Promise.all([
            getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month'),
            getMonthlyExpenseTrend(7, new Date(), false),
            getNetWorthTrend(7, new Date()),
            getMonthlyCashFlow(7, new Date(), false),
            getCategoryMonthlyTotals(7, new Date(), false),
            getDailyExpenseTotals(range, false),
            listCategories(),
            getTidyUpReport(),
            listAccounts(),
          ]),
        62,
        2000,
      ],
      [
        'Plan',
        () => Promise.all([listLoans(), getLoanProgress(), listPeople(), listSavingsGoals(), listAccounts()]),
        8,
        1500,
      ],
    ];

    it.each(loads)('%s', async (_name, load, maxQueries, maxMs) => {
      await load(); // warm
      const { ms, queries } = await loadWithStats(load);
      expect(queries).toBeLessThanOrEqual(maxQueries);
      expect(ms).toBeLessThan(maxMs);
    });
  });
});
