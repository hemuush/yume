/**
 * Which months of the cash-flow bars count as "recorded". A month before the first entry is not (nothing was being
 * tracked); a month after it is, even an empty one. The first entry can be far older than the months shown, so it is
 * found separately from the sums, and a quiet stretch must not read as "not recorded".
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getMonthlyCashFlow } from '@/db/reports';

describe('months recorded in the cash-flow bars', () => {
  const reference = new Date(2026, 9, 3); // October 2026
  let accountId: string;
  let food: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
    food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  });

  const add = (date: string, amountMinor = 100000) =>
    createTransaction({ type: 'expense', accountId, categoryId: food, amountMinor, date });

  it('does not count the months before the first entry, only the ones from it on', async () => {
    await add('2026-09-10');
    const flow = await getMonthlyCashFlow(4, reference);
    expect(flow.map((p) => [p.month, p.recorded, p.expenseMinor])).toEqual([
      ['2026-07', false, 0],
      ['2026-08', false, 0],
      ['2026-09', true, 100000],
      ['2026-10', true, 0],
    ]);
  });

  it('counts an empty month as recorded when the first entry is older than every month shown', async () => {
    // The first entry is in January: August and September have nothing in them but were still being tracked.
    await add('2026-01-15');
    await mockTestDb.runAsync(`DELETE FROM transactions WHERE date = '2026-09-10'`);
    await add('2026-10-05', 250000);
    const flow = await getMonthlyCashFlow(3, reference);
    expect(flow.map((p) => [p.month, p.recorded, p.expenseMinor])).toEqual([
      ['2026-08', true, 0],
      ['2026-09', true, 0],
      ['2026-10', true, 250000],
    ]);
  });

  it('shows nothing as recorded for a ledger with no entries', async () => {
    await mockTestDb.runAsync(`DELETE FROM transactions`);
    const flow = await getMonthlyCashFlow(3, reference);
    expect(flow.every((p) => p.recorded === false && p.incomeMinor === 0 && p.expenseMinor === 0)).toBe(true);
  });
});
