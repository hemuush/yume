/**
 * Refunds in a real database: money back on a purchase lowers that
 * category's spending (and the month's) everywhere it's added up, never
 * counts as income, never takes a total below zero, puts the money back in
 * the account, and can only go to a spending category. All figures are made up.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
  notifyBudget: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  updateTransaction,
  getAccountBalance,
  getRepeatEntries,
} from '@/db/ledger';
import {
  getPeriodSummary,
  getDailyExpenseTotals,
  getCategoryOverview,
  getSubcategoryBreakdown,
} from './reports';
import { createBudget, listBudgetsForMonth } from './budgets';

const SEPT = { start: '2026-09-01', end: '2026-09-30' };
let bank: string;
let shopping: string;
let salary: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

beforeEach(async () => {
  for (const table of ['budgets', 'deleted_entries', 'transactions', 'categories', 'accounts']) {
    await mockTestDb.runAsync(`DELETE FROM ${table}`);
  }
  bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1_000_000 })
  ).id;
  shopping = (await createCategory({ name: 'Shopping', kind: 'expense' })).id;
  salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
  await createTransaction({
    type: 'income',
    accountId: bank,
    categoryId: salary,
    amountMinor: 5_000_000,
    date: '2026-09-01',
  });
  await createTransaction({
    type: 'expense',
    accountId: bank,
    categoryId: shopping,
    amountMinor: 670_000,
    date: '2026-09-12',
  });
});

const refund = (amountMinor: number, date = '2026-09-20') =>
  createTransaction({
    type: 'income',
    accountId: bank,
    categoryId: shopping,
    amountMinor,
    date,
    note: 'Amazon return',
    isRefund: true,
  });

describe('refunds', () => {
  it("lower the category's and the month's spending, and never count as income", async () => {
    await refund(249_900);
    const summary = await getPeriodSummary(SEPT);
    expect(summary.expenseMinor).toBe(670_000 - 249_900);
    expect(summary.incomeMinor).toBe(5_000_000);
    expect(summary.categoryBreakdown).toEqual([
      expect.objectContaining({ categoryId: shopping, totalMinor: 420_100 }),
    ]);
    expect(summary.incomeBreakdown.map((c) => c.categoryId)).toEqual([salary]);
  });

  it('put the money back in the account', async () => {
    await refund(249_900);
    expect(await getAccountBalance(bank)).toBe(1_000_000 + 5_000_000 - 670_000 + 249_900);
  });

  it('show on the category page as money back, without counting as an extra entry', async () => {
    await refund(249_900);
    const overview = await getCategoryOverview(shopping, 'expense', SEPT);
    expect(overview).toMatchObject({
      totalMinor: 420_100,
      refundMinor: 249_900,
      spentMinor: 670_000,
      count: 1,
    });
    const split = await getSubcategoryBreakdown(shopping, SEPT);
    expect(split[0]).toMatchObject({ totalMinor: 420_100, count: 1 });
  });

  it("lower the day's spending, and a budget's", async () => {
    await refund(100_000, '2026-09-12');
    expect(await getDailyExpenseTotals(SEPT)).toEqual([{ date: '2026-09-12', totalMinor: 570_000 }]);
    await createBudget({
      categoryId: shopping,
      limitAmountMinor: 1_000_000,
      rollover: false,
      periodMonth: '2026-09',
    });
    const [b] = await listBudgetsForMonth('2026-09');
    expect(b.spentMinor).toBe(570_000);
  });

  it('never take a total below zero', async () => {
    await refund(900_000);
    const summary = await getPeriodSummary(SEPT);
    expect(summary.expenseMinor).toBe(0);
    expect(summary.categoryBreakdown).toEqual([]);
    expect(await getCategoryOverview(shopping, 'expense', SEPT)).toMatchObject({
      totalMinor: 0,
      spentMinor: 670_000,
      refundMinor: 900_000,
    });
    expect(await getDailyExpenseTotals({ start: '2026-09-20', end: '2026-09-20' })).toEqual([]);
  });

  it('only go to a spending category, as money in', async () => {
    await expect(
      createTransaction({
        type: 'income',
        accountId: bank,
        categoryId: salary,
        amountMinor: 100,
        date: '2026-09-20',
        isRefund: true,
      })
    ).rejects.toThrow('spending category');
    await expect(
      createTransaction({
        type: 'expense',
        accountId: bank,
        categoryId: shopping,
        amountMinor: 100,
        date: '2026-09-20',
        isRefund: true,
      })
    ).rejects.toThrow('money coming back');
  });

  it('keep their flag through an edit, and lose it if the type changes', async () => {
    const r = await refund(10_000);
    const kept = await updateTransaction(r.id, {
      type: 'income',
      accountId: bank,
      categoryId: shopping,
      amountMinor: 20_000,
      date: '2026-09-20',
    });
    expect(kept.isRefund).toBe(true);
    const changed = await updateTransaction(r.id, {
      type: 'expense',
      accountId: bank,
      categoryId: shopping,
      amountMinor: 20_000,
      date: '2026-09-20',
    });
    expect(changed.isRefund).toBe(false);
  });

  it("stay out of Add's usual chips", async () => {
    await refund(249_900, '2026-09-20');
    await refund(249_900, '2026-09-21');
    const usual = await getRepeatEntries(5, '2026-09-27', 'income');
    expect(usual.every((u) => u.categoryId !== shopping)).toBe(true);
  });
});
