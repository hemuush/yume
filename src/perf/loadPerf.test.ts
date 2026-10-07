/**
 * Load benchmark (run with PERF=1): a heavy, realistic ledger on real SQLite, timing what each main screen
 * loads and counting its database round-trips. On the phone every round-trip waits its turn in one queue
 * (db/client.ts), so the count matters as much as the time. Skipped in normal test runs.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockRaw = createRealDataTestDb();
const mockStats = { calls: 0 };
/** Time per SQL statement (by its first 90 characters), for the slowest-queries list. */
const mockSlow = new Map<string, { ms: number; n: number }>();
const counted = async <T>(fn: () => Promise<T>, sql = '(transaction)') => {
  mockStats.calls++;
  const t = performance.now();
  const out = await fn();
  const key = sql.replace(/\s+/g, ' ').trim().slice(0, 90);
  const e = mockSlow.get(key) ?? { ms: 0, n: 0 };
  e.ms += performance.now() - t;
  e.n++;
  mockSlow.set(key, e);
  return out;
};
const mockTestDb = {
  getFirstAsync: <T>(sql: string, p?: any[]) => counted(() => mockRaw.getFirstAsync<T>(sql, p), sql),
  getAllAsync: <T>(sql: string, p?: any[]) => counted(() => mockRaw.getAllAsync<T>(sql, p), sql),
  runAsync: (sql: string, p?: any[]) =>
    counted(() => mockRaw.runAsync(sql, p).finally(require('@/db/dataVersion').bumpDataVersion), sql),
  execAsync: (sql: string) =>
    counted(() => mockRaw.execAsync(sql).finally(require('@/db/dataVersion').bumpDataVersion), sql),
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
import { setDefaultCurrency, resetSettingsCache } from '@/db/settings';
import { listAccounts, listCategories, listTransactions, searchTransactions } from '@/db/ledger';
import { listLoans, getLoanProgress, getNextDueInstallment } from '@/db/loans';
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
import { getTidyUpReport, findRepeatGroups, findStartingBalances } from '@/db/tidyUp';
import { countFractionalLedgerAmounts } from '@/db/maintenance';
import { findMonthlyPatterns } from '@/db/subscriptions';
import { loadNeedsYou } from '@/features/home/needsYouData';
import { loadReadyWraps } from '@/features/wrap/wrapWindow';
import { buildBackupSnapshot } from '@/lib/backup';
import { periodRange, previousPeriodRange, CURRENT_PERIOD } from '@/lib/period';

const run = process.env.PERF === '1' ? describe : describe.skip;

async function measure(name: string, load: () => Promise<unknown>) {
  // Cold: nothing shared from an earlier load (a write has just happened).
  clearReadCache();
  resetSettingsCache();
  await setDefaultCurrency('INR');
  mockStats.calls = 0;
  const start = performance.now();
  await load();
  const ms = performance.now() - start;
  results.push({ name, ms: Math.round(ms), calls: mockStats.calls });
}
const results: { name: string; ms: number; calls: number }[] = [];

const range = periodRange(CURRENT_PERIOD);
const homeLoad = () =>
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
  ]);
const activityLoad = () =>
  Promise.all([
    listTransactions({ fromDate: range.start, toDate: range.end }),
    listAccounts(),
    listCategories(),
    getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month'),
  ]);
const reportsLoad = () =>
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
  ]);
const planLoad = () =>
  Promise.all([listLoans(), getLoanProgress(), listPeople(), listSavingsGoals(), listAccounts()]);

run('load performance', () => {
  jest.setTimeout(600000);
  beforeAll(async () => {
    await seedLedger(mockRaw, Number(process.env.PERF_ENTRIES ?? 20000));
    // As the real database does: writes move the data version on, and shared reads are cached per version.
    trackDataVersion();
  });

  it('times every main screen load', async () => {
    // Warm once (statement compilation), then measure.
    await homeLoad();
    mockSlow.clear();
    await measure('Home', homeLoad);
    await measure('Activity (month)', activityLoad);
    await measure('Reports (month)', reportsLoad);
    await measure('Plan', planLoad);
    await measure('Search "lunch"', () => searchTransactions('lunch'));
    await measure('Needs you alone', () => loadNeedsYou());
    await measure('Tidy up report', () => getTidyUpReport());
    await measure('Budgets', () => listBudgetsForMonth(undefined, false));
    await measure('Net worth trend (7)', () => getNetWorthTrend(7, new Date()));
    await measure('Backup snapshot', () => buildBackupSnapshot());
    // Each loader alone, one after another, so its time is its own (in Promise.all they overlap).
    const loaders: [string, () => Promise<unknown>][] = [
      ['listTransactions(6)', () => listTransactions({ fromDate: range.start, toDate: range.end, limit: 6 })],
      ['getRangeComparison', () => getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month')],
      ['getCarryInMinor', () => getCarryInMinor(range.start, false)],
      ['listAccounts', () => listAccounts()],
      ['listCategories', () => listCategories()],
      ['listLoans', () => listLoans()],
      ['listRecurringRules', () => listRecurringRules()],
      ['getLoanProgress', () => getLoanProgress()],
      ['listCardCycles', () => listCardCycles()],
      ['listSavingsGoals', () => listSavingsGoals()],
      ['getTodaySpend', () => getTodaySpend(undefined, false)],
      ['getMonthPaceInputs', () => getMonthPaceInputs()],
      ['getStillToPayThisMonth', () => getStillToPayThisMonth()],
      ['getNextDueInstallment', () => getNextDueInstallment()],
      ['loadReadyWraps', () => loadReadyWraps()],
      ['getMonthlyExpenseTrend', () => getMonthlyExpenseTrend(7, new Date(), false)],
      ['getMonthlyCashFlow', () => getMonthlyCashFlow(7, new Date(), false)],
      ['getCategoryMonthlyTotals', () => getCategoryMonthlyTotals(7, new Date(), false)],
      ['getDailyExpenseTotals', () => getDailyExpenseTotals(range, false)],
      ['listPeople', () => listPeople()],
      ['findRepeatGroups', () => findRepeatGroups()],
      ['findStartingBalances', () => findStartingBalances()],
      ['countFractional', () => countFractionalLedgerAmounts()],
      ['findMonthlyPatterns', () => findMonthlyPatterns()],
    ];
    for (const [name, load] of loaders) await measure(`  ${name}`, load);
    if (process.env.PERF_PLAN) {
      const sql = require('fs').readFileSync(process.env.PERF_PLAN, 'utf8');
      console.log(JSON.stringify(await mockRaw.getAllAsync('EXPLAIN QUERY PLAN ' + sql), null, 1));
      const t0 = performance.now();
      const rows = await mockRaw.getAllAsync(sql);
      console.log(`PLAN-SQL took ${Math.round(performance.now() - t0)}ms for ${rows.length} rows`);
    }
    console.log(
      ['', 'screen'.padEnd(24) + 'ms'.padStart(8) + 'queries'.padStart(10)]
        .concat(
          results.map((r) => r.name.padEnd(24) + String(r.ms).padStart(8) + String(r.calls).padStart(10))
        )
        .join('\n')
    );
  });
});
