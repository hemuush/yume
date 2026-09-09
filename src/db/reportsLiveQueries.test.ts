/**
 * Runs every report function that touches SQL directly against a real
 * SQLite engine. The rest of reports.ts's test coverage (src/db/reports.test.ts)
 * only exercises pure functions with no database — that gap is exactly how
 * a real bug (`getIncomeExpenseTrend`'s GROUP BY referencing an unqualified
 * `type` column that's ambiguous once joined against `accounts`, which also
 * has a `type` column) shipped without any test catching it. These tests
 * seed real data and call the real functions so a broken query fails here,
 * not on a user's device.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import {
  getPeriodSummary,
  getRangeComparison,
  getMonthlyExpenseTrend,
  getIncomeExpenseTrend,
  getNetWorthTrend,
  getPeriodRanges,
} from '@/db/reports';

describe('report queries against a real SQLite engine', () => {
  let accountId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const account = await createAccount({
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    accountId = account.id;
    const salary = await createCategory({ name: 'Salary', kind: 'income' });
    const food = await createCategory({ name: 'Food', kind: 'expense' });

    await createTransaction({
      type: 'income',
      accountId,
      categoryId: salary.id,
      amountMinor: 500000,
      date: '2026-01-05',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: food.id,
      amountMinor: 12000,
      date: '2026-01-10',
    });
    await createTransaction({
      type: 'income',
      accountId,
      categoryId: salary.id,
      amountMinor: 500000,
      date: '2026-02-05',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: food.id,
      amountMinor: 15000,
      date: '2026-02-10',
    });
  });

  it('getPeriodSummary runs and totals correctly for a month with data', async () => {
    const summary = await getPeriodSummary({ start: '2026-01-01', end: '2026-01-31' });
    expect(summary.incomeMinor).toBe(500000);
    expect(summary.expenseMinor).toBe(12000);
  });

  it('getRangeComparison runs for both month and year granularity without a SQL error', async () => {
    const monthRanges = getPeriodRanges('month', new Date('2026-02-15'));
    const monthCmp = await getRangeComparison(monthRanges.current, monthRanges.previous, 'month');
    expect(monthCmp.current.incomeMinor).toBe(500000);
    expect(monthCmp.previous.incomeMinor).toBe(500000);

    const yearRanges = getPeriodRanges('year', new Date('2026-06-15'));
    const yearCmp = await getRangeComparison(yearRanges.current, yearRanges.previous, 'year');
    expect(yearCmp.current.incomeMinor).toBe(1000000);
  });

  it('getMonthlyExpenseTrend runs without a SQL error and totals each month', async () => {
    const trend = await getMonthlyExpenseTrend(2, new Date('2026-02-28'));
    expect(trend.map((t) => t.totalMinor)).toEqual([12000, 15000]);
  });

  it('getIncomeExpenseTrend runs without a SQL error — regression test for the ambiguous "type" column bug', async () => {
    const trend = await getIncomeExpenseTrend(2, new Date('2026-02-28'));
    expect(trend.map((t) => t.incomeMinor)).toEqual([500000, 500000]);
    expect(trend.map((t) => t.expenseMinor)).toEqual([12000, 15000]);
  });

  it('getNetWorthTrend runs without a SQL error across multiple months', async () => {
    const trend = await getNetWorthTrend(2, new Date('2026-02-28'));
    expect(trend).toHaveLength(2);
    expect(trend[1].netWorthMinor).toBe(500000 - 12000 + 500000 - 15000);
  });
});
