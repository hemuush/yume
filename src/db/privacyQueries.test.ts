/**
 * "Hide savings & investment amounts" at the query level, against a real
 * SQLite engine: with `excludeSensitive`, spend in a sensitive category (an
 * SIP, say) is left out of the day, trend and budget figures, so nothing on
 * screen can be subtracted back into what was invested.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { createBudget, listBudgetsForMonth, listLapsedBudgets } from '@/db/budgets';
import {
  getDailyExpenseTotals,
  getTodaySpend,
  getMonthlyExpenseTrend,
  getRangeComparison,
} from '@/db/reports';
import { privateComparison } from '@/lib/privateSummary';

describe('excluding sensitive categories', () => {
  let accountId: string;
  let foodId: string;
  let investId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
    foodId = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    investId = (await createCategory({ name: 'SIP', kind: 'expense', isSensitive: true })).id;
    for (const [categoryId, amountMinor, date] of [
      [foodId, 30000, '2026-03-10'],
      [investId, 500000, '2026-03-10'],
      [foodId, 20000, '2026-03-11'],
    ] as const) {
      await createTransaction({ type: 'expense', accountId, categoryId, amountMinor, date });
    }
    for (const periodMonth of ['2026-03', '2026-02']) {
      await createBudget({ categoryId: foodId, limitAmountMinor: 100000, rollover: false, periodMonth });
      await createBudget({ categoryId: investId, limitAmountMinor: 600000, rollover: false, periodMonth });
    }
  });

  it('leaves a sensitive category out of the daily totals and today figure', async () => {
    const range = { start: '2026-03-10', end: '2026-03-11' };
    const all = await getDailyExpenseTotals(range);
    const hidden = await getDailyExpenseTotals(range, true);
    expect(all.map((d) => d.totalMinor)).toEqual([530000, 20000]);
    expect(hidden.map((d) => d.totalMinor)).toEqual([30000, 20000]);
    expect(await getTodaySpend('2026-03-10')).toBe(530000);
    expect(await getTodaySpend('2026-03-10', true)).toBe(30000);
  });

  it('leaves a sensitive category out of the monthly trend', async () => {
    const reference = new Date(2026, 2, 15);
    const all = await getMonthlyExpenseTrend(1, reference);
    const hidden = await getMonthlyExpenseTrend(1, reference, true);
    expect(all[0].totalMinor).toBe(550000);
    expect(hidden[0].totalMinor).toBe(50000);
  });

  it('leaves a sensitive category out of budgets and the lapsed prompt', async () => {
    const all = await listBudgetsForMonth('2026-03');
    const hidden = await listBudgetsForMonth('2026-03', true);
    expect(all.map((b) => b.categoryName).sort()).toEqual(['Food', 'SIP']);
    expect(hidden.map((b) => b.categoryName)).toEqual(['Food']);

    const lapsedAll = await listLapsedBudgets('2026-04');
    const lapsedHidden = await listLapsedBudgets('2026-04', true);
    expect(lapsedAll.map((b) => b.categoryName).sort()).toEqual(['Food', 'SIP']);
    expect(lapsedHidden.map((b) => b.categoryName)).toEqual(['Food']);
  });

  it('privateComparison on real data removes the investment from spend and its rows', async () => {
    const cmp = await getRangeComparison(
      { start: '2026-03-01', end: '2026-03-31' },
      { start: '2026-02-01', end: '2026-02-28' }
    );
    expect(cmp.current.expenseMinor).toBe(550000);
    const priv = privateComparison(cmp, true);
    expect(priv.current.expenseMinor).toBe(50000);
    expect(priv.current.categoryBreakdown.map((c) => c.name)).toEqual(['Food']);
    expect(privateComparison(cmp, false)).toBe(cmp);
  });
});
