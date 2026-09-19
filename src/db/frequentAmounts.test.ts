/**
 * getFrequentAmountsForCategory against a real SQLite engine — same
 * reasoning as reportsLiveQueries.test.ts.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, getFrequentAmountsForCategory } from '@/db/ledger';

describe('getFrequentAmountsForCategory', () => {
  let accountId: string;
  let foodId: string;
  let travelId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const account = await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 });
    accountId = account.id;
    const food = await createCategory({ name: 'Food', kind: 'expense' });
    foodId = food.id;
    const travel = await createCategory({ name: 'Travel', kind: 'expense' });
    travelId = travel.id;

    // ₹150 logged 3 times, ₹220 logged 2 times, ₹900 once, all within 90 days of the reference date.
    for (const date of ['2026-01-01', '2026-01-05', '2026-01-10']) {
      await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 15000, date });
    }
    for (const date of ['2026-01-02', '2026-01-08']) {
      await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 22000, date });
    }
    await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 90000, date: '2026-01-12' });
    // Way outside the 90-day window — must not affect the ranking.
    await createTransaction({ type: 'expense', accountId, categoryId: foodId, amountMinor: 500000, date: '2025-01-01' });
    // A different category entirely — must not leak into Food's ranking.
    await createTransaction({ type: 'expense', accountId, categoryId: travelId, amountMinor: 99999, date: '2026-01-12' });
  });

  it('ranks by frequency, most-repeated amount first', async () => {
    const amounts = await getFrequentAmountsForCategory(foodId, 4, '2026-01-15');
    expect(amounts).toEqual([15000, 22000, 90000]);
  });

  it('respects the limit', async () => {
    const amounts = await getFrequentAmountsForCategory(foodId, 1, '2026-01-15');
    expect(amounts).toEqual([15000]);
  });

  it('a category with no recent history returns nothing', async () => {
    const amounts = await getFrequentAmountsForCategory(travelId, 4, '2020-01-01');
    expect(amounts).toEqual([]);
  });
});
