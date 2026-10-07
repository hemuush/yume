/**
 * Output parity (run with PERF=1 and PARITY_OUT=<file>): builds the standard heavy test ledger and writes
 * every figure the screens read to a JSON file, so two versions of the code can be compared line by line
 * (e.g. before and after a performance change). Uses only long-standing functions, so it runs on older
 * code too. Skipped in normal test runs.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockRaw = createRealDataTestDb();
jest.mock('@/db/client', () => ({ ...jest.requireActual('@/db/client'), getDb: async () => mockRaw }));
jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));

import { writeFileSync } from 'fs';
import { seedLedger } from './seedLedger';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans, getLoanProgress, getLoanSchedule } from '@/db/loans';
import { listCardCycles } from '@/db/cardCycles';
import { listBudgetsForMonth, listLapsedBudgets } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { listPeople } from '@/db/people';
import { listValuations } from '@/db/valuations';
import {
  getRangeComparison,
  getCarryInMinor,
  getMonthlyExpenseTrend,
  getNetWorthTrend,
  getMonthlyCashFlow,
  getCategoryMonthlyTotals,
  getDailyExpenseTotals,
  getCategoryOverview,
  getAccountBreakdown,
  getLargestExpenses,
  getSubcategoryBreakdown,
  getCategoryMonthlyAverages,
  getDailyGoalStreakSeries,
  getMonthPaceInputs,
  getStillToPayThisMonth,
} from '@/db/reports';
import { getTidyUpReport } from '@/db/tidyUp';
import { findMonthlyPatterns, findUnscheduledSubscriptions } from '@/db/subscriptions';
import { periodRange, previousPeriodRange } from '@/lib/period';

const run = process.env.PERF === '1' ? describe : describe.skip;

/** Drops when-it-was-saved stamps, which differ between any two runs. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => k !== 'createdAt' && k !== 'created_at' && k !== 'savedAt')
        .map(([k, v]) => [k, stable(v)])
    );
  }
  return value;
}

run('output parity', () => {
  jest.setTimeout(600000);

  it('writes every figure the screens read', async () => {
    await seedLedger(mockRaw, Number(process.env.PERF_ENTRIES ?? 20000));
    const out: Record<string, unknown> = {};
    const put = async (name: string, read: () => Promise<unknown>) => {
      out[name] = stable(await read());
    };

    await put('accounts', () => listAccounts(true));
    await put('categories', () => listCategories(true));
    await put('loans', () => listLoans());
    await put('loanProgress', () => getLoanProgress());
    await put('loanSchedule l0', () => getLoanSchedule('l0'));
    await put('cardCycles', () => listCardCycles());
    await put('goals', () => listSavingsGoals(true));
    await put('people', () => listPeople(true));
    await put('valuations', () => listValuations('sav2'));
    await put('tidyUp', () => getTidyUpReport());
    await put('monthlyPatterns', () => findMonthlyPatterns());
    await put('unscheduledSubscriptions', () => findUnscheduledSubscriptions());
    await put('categoryAverages', () => getCategoryMonthlyAverages(3));
    await put('netWorth 7', () => getNetWorthTrend(7, new Date()));
    await put('netWorth 24', () => getNetWorthTrend(24, new Date()));
    await put('streak', () => getDailyGoalStreakSeries(150000, 30));
    // Changed on purpose (weekly/daily bills now counted every time): compared separately.
    await put('pace (intended change)', () => getMonthPaceInputs());
    await put('stillToPay (intended change)', () => getStillToPayThisMonth());

    for (const hide of [false, true]) {
      await put(`expenseTrend hide=${hide}`, () => getMonthlyExpenseTrend(12, new Date(), hide));
      await put(`cashFlow hide=${hide}`, () => getMonthlyCashFlow(12, new Date(), hide));
      await put(`categoryTotals hide=${hide}`, () => getCategoryMonthlyTotals(12, new Date(), hide));
    }

    // The last 14 months, one by one, plus three whole years: every month a person can browse.
    const now = new Date();
    for (let offset = 0; offset > -14; offset--) {
      const cursor = { granularity: 'month' as const, offset };
      const range = periodRange(cursor, now);
      const key = range.start.slice(0, 7);
      await put(`comparison ${key}`, () =>
        getRangeComparison(range, previousPeriodRange(cursor, now), 'month')
      );
      await put(`carryIn ${key}`, () => getCarryInMinor(range.start, false));
      await put(`carryIn hidden ${key}`, () => getCarryInMinor(range.start, true));
      await put(`daily ${key}`, () => getDailyExpenseTotals(range, false));
      await put(`byAccount ${key}`, () => getAccountBreakdown(range, 'expense', false));
      await put(`largest ${key}`, () => getLargestExpenses(range, 10, false));
      await put(`transactions ${key}`, () => listTransactions({ fromDate: range.start, toDate: range.end }));
      await put(`budgets ${key}`, () => listBudgetsForMonth(key, false));
      await put(`budgets hidden ${key}`, () => listBudgetsForMonth(key, true));
      await put(`lapsedBudgets ${key}`, () => listLapsedBudgets(key, false));
      for (const cat of ['c7', 'c9', 'c9s0', 'c21']) {
        await put(`category ${cat} ${key}`, () => getCategoryOverview(cat, 'expense', range));
        await put(`subcategories ${cat} ${key}`, () => getSubcategoryBreakdown(cat, range));
      }
    }
    for (let offset = 0; offset > -3; offset--) {
      const cursor = { granularity: 'year' as const, offset };
      const range = periodRange(cursor, now);
      await put(`year ${range.start.slice(0, 4)}`, () =>
        getRangeComparison(range, previousPeriodRange(cursor, now), 'year')
      );
    }

    writeFileSync(process.env.PARITY_OUT ?? 'parity.json', JSON.stringify(out, null, 1));
    expect(Object.keys(out).length).toBeGreaterThan(100);
  });
});
