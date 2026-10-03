/**
 * The Trends in-and-out and per-category queries on a real SQLite engine, with made-up entries: income against
 * spending per month, refunds taking spend down rather than counting as income, sub-categories rolled up to
 * their parent, and sensitive categories left out when amounts are hidden.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getMonthlyCashFlow, getCategoryMonthlyTotals } from '@/db/reports';

describe('monthly cash flow and category tracks', () => {
  const reference = new Date(2026, 9, 3);

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const accountId = (
      await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    const salary = await createCategory({ name: 'Salary', kind: 'income' });
    const food = await createCategory({ name: 'Food', kind: 'expense' });
    const dining = await createCategory({ name: 'Dining', kind: 'expense', parentId: food.id });
    const sip = await createCategory({ name: 'SIP', kind: 'expense', isSensitive: true });
    const add = (
      type: 'income' | 'expense',
      categoryId: string,
      amountMinor: number,
      date: string,
      isRefund = false
    ) => createTransaction({ type, accountId, categoryId, amountMinor, date, isRefund });

    await add('income', salary.id, 8000000, '2026-08-01');
    await add('expense', food.id, 300000, '2026-08-05');
    await add('expense', dining.id, 100000, '2026-08-09');
    await add('income', salary.id, 8000000, '2026-09-01');
    await add('expense', food.id, 400000, '2026-09-04');
    await add('expense', sip.id, 2000000, '2026-09-06');
    await add('income', food.id, 50000, '2026-09-20', true);
    await add('expense', dining.id, 250000, '2026-10-02');
  });

  it('puts income beside spending for each month, oldest first', async () => {
    const flow = await getMonthlyCashFlow(4, reference);
    expect(flow.map((p) => p.label)).toHaveLength(4);
    expect(flow.map((p) => [p.incomeMinor, p.expenseMinor])).toEqual([
      [0, 0],
      [8000000, 400000],
      [8000000, 2350000],
      [0, 250000],
    ]);
  });

  it('counts a refund against spending, not as income', async () => {
    const flow = await getMonthlyCashFlow(2, reference);
    expect(flow[0].incomeMinor).toBe(8000000);
    expect(flow[0].expenseMinor).toBe(400000 + 2000000 - 50000);
  });

  it('leaves a sensitive category out when amounts are hidden', async () => {
    const flow = await getMonthlyCashFlow(2, reference, true);
    expect(flow[0].expenseMinor).toBe(400000 - 50000);
  });

  it('rolls sub-categories up to their parent for the tracks', async () => {
    const tracks = await getCategoryMonthlyTotals(3, reference);
    const food = tracks.find((t) => t.name === 'Food')!;
    expect(food.totalsMinor).toEqual([400000, 350000, 250000]);
    expect(tracks.find((t) => t.name === 'Dining')).toBeUndefined();
  });

  it('leaves a sensitive category out of the tracks when amounts are hidden', async () => {
    expect((await getCategoryMonthlyTotals(3, reference)).some((t) => t.name === 'SIP')).toBe(true);
    expect((await getCategoryMonthlyTotals(3, reference, true)).some((t) => t.name === 'SIP')).toBe(false);
  });
});
