/** A note is stored without the spaces around it: one that is only spaces would show as a blank name in Activity. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, updateTransaction } from '@/db/ledger';

it('trims a note on save and on edit, so an empty one falls back to the category name', async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  const accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR' })).id;
  const categoryId = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  const entry = { type: 'expense' as const, accountId, categoryId, amountMinor: 3000, date: '2026-11-20' };

  expect((await createTransaction({ ...entry, note: '   ' })).note).toBe('');
  const coffee = await createTransaction({ ...entry, note: '  Coffee  ' });
  expect(coffee.note).toBe('Coffee');
  expect((await updateTransaction(coffee.id, { ...entry, note: ' Tea ' })).note).toBe('Tea');
});
