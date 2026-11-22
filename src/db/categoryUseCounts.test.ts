/** The Categories page's per-category entry counts: only a category's own entries, none for an unused one. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, getCategoryUseCounts } from '@/db/ledger';

it('counts entries per category, and leaves out a category with none', async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  const bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const food = await createCategory({ name: 'Food', kind: 'expense' });
  const swiggy = await createCategory({ name: 'Swiggy', kind: 'expense', parentId: food.id });
  const rent = await createCategory({ name: 'Rent', kind: 'expense' });
  const add = (categoryId: string) =>
    createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId,
      amountMinor: 10000,
      date: '2026-11-01',
    });
  await add(food.id);
  await add(swiggy.id);
  await add(swiggy.id);
  const counts = await getCategoryUseCounts();
  expect(counts.get(food.id)).toBe(1);
  expect(counts.get(swiggy.id)).toBe(2);
  expect(counts.has(rent.id)).toBe(false);
});
