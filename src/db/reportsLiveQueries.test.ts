/**
 * Runs every SQL-touching report function against a real SQLite engine; reports.test.ts only covers pure
 * functions, which once let an ambiguous unqualified `type` in a GROUP BY (joined with `accounts`) ship.
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
  getNetWorthTrend,
  getPeriodRanges,
  getTodaySpend,
  getTodayEverydaySpend,
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

  it('breaks income down by category too, and a custom range totals the same as its months', async () => {
    const jan = await getPeriodSummary({ start: '2026-01-01', end: '2026-01-31' });
    expect(jan.incomeBreakdown.map((c) => [c.name, c.totalMinor])).toEqual([['Salary', 500000]]);
    expect(jan.categoryBreakdown.map((c) => [c.name, c.totalMinor])).toEqual([['Food', 12000]]);
    const feb = await getPeriodSummary({ start: '2026-02-01', end: '2026-02-28' });
    const both = await getPeriodSummary({ start: '2026-01-01', end: '2026-02-28' });
    expect(both.incomeMinor).toBe(jan.incomeMinor + feb.incomeMinor);
    expect(both.expenseMinor).toBe(jan.expenseMinor + feb.expenseMinor);
    expect(both.incomeBreakdown[0].totalMinor).toBe(1000000);
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

  it('getNetWorthTrend runs without a SQL error across multiple months', async () => {
    const trend = await getNetWorthTrend(2, new Date('2026-02-28'));
    expect(trend).toHaveLength(2);
    expect(trend[1].netWorthMinor).toBe(500000 - 12000 + 500000 - 15000);
  });

  it('getTodaySpend totals just the given day, and is 0 for a day with no expense', async () => {
    expect(await getTodaySpend('2026-01-10')).toBe(12000);
    expect(await getTodaySpend('2026-01-11')).toBe(0);
    // The income-only day above shouldn't leak into a "spend" figure either.
    expect(await getTodaySpend('2026-01-05')).toBe(0);
  });

  it('getTodayEverydaySpend leaves out system categories and entries a repeating rule posted', async () => {
    const cafe = await createCategory({ name: 'Cafe', kind: 'expense' });
    const emi = await createCategory({ name: 'Home EMI', kind: 'expense' });
    await mockTestDb.runAsync('UPDATE categories SET is_system = 1 WHERE id = ?', [emi.id]);
    const day = '2026-02-03';
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: cafe.id,
      amountMinor: 20000,
      date: day,
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: emi.id,
      amountMinor: 1800000,
      date: day,
    });
    const bill = await createTransaction({
      type: 'expense',
      accountId,
      categoryId: cafe.id,
      amountMinor: 300000,
      date: day,
    });
    await mockTestDb.runAsync("UPDATE transactions SET rule_id = 'rule' WHERE id = ?", [bill.id]);
    // All three count in the day's outgoing total; only the typed-in cafe entry is a choice made today.
    expect(await getTodaySpend(day)).toBe(20000 + 1800000 + 300000);
    expect(await getTodayEverydaySpend(day)).toBe(20000);
    expect(await getTodayEverydaySpend('2026-02-04')).toBe(0);
  });

  it('getTodayEverydaySpend nets a refund against the day’s purchases', async () => {
    const shop = await createCategory({ name: 'Shop', kind: 'expense' });
    const day = '2026-02-05';
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: shop.id,
      amountMinor: 200000,
      date: day,
    });
    const back = await createTransaction({
      type: 'income',
      accountId,
      categoryId: shop.id,
      amountMinor: 50000,
      date: day,
    });
    await mockTestDb.runAsync('UPDATE transactions SET is_refund = 1 WHERE id = ?', [back.id]);
    expect(await getTodayEverydaySpend(day)).toBe(150000);
  });
});
