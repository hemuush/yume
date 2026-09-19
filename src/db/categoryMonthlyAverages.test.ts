/**
 * getCategoryMonthlyAverages against a real SQLite engine — same reasoning
 * as reportsLiveQueries.test.ts.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getCategoryMonthlyAverages } from '@/db/reports';

describe('getCategoryMonthlyAverages', () => {
  let accountId: string;
  let foodId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const account = await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 });
    accountId = account.id;
    const food = await createCategory({ name: 'Food', kind: 'expense' });
    foodId = food.id;

    // Reference date is 2026-04-15, so the last 3 full months are Jan/Feb/Mar.
    await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 60000, date: '2026-01-10' });
    await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 30000, date: '2026-02-10' });
    await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 90000, date: '2026-03-10' });
    // Outside the window entirely — must not affect the average.
    await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 999999, date: '2025-01-10' });
    // This month is excluded (a partial month would skew a "monthly average").
    await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 500000, date: '2026-04-05' });
  });

  it('averages the last N full calendar months, excluding the current partial month', async () => {
    const averages = await getCategoryMonthlyAverages(3, new Date(2026, 3, 15)); // April 15, 2026
    const food = averages.find((c) => c.categoryId === foodId);
    // (60000 + 30000 + 90000) / 3 = 60000
    expect(food?.totalMinor).toBe(60000);
  });
});
