/**
 * An entry too large for a float to hold exactly would corrupt every SUM it joins. Screens refuse it (see
 * toMinor); this checks create and edit refuse it too, and the largest accepted amount saves exactly.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, updateTransaction } from '@/db/ledger';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';

describe('transaction amount ceiling', () => {
  let accountId: string;
  let categoryId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
    categoryId = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  });

  const input = (amountMinor: number) => ({
    type: 'expense' as const,
    accountId,
    categoryId,
    amountMinor,
    date: '2026-01-01',
  });

  it('rejects a new entry above the ceiling', async () => {
    await expect(createTransaction(input(MAX_AMOUNT_MINOR + 100))).rejects.toThrow('too large');
    await expect(createTransaction(input(1e23))).rejects.toThrow('too large');
  });

  it('saves an entry at the ceiling and stores it exactly', async () => {
    const tx = await createTransaction(input(MAX_AMOUNT_MINOR));
    const row = await mockTestDb.getFirstAsync<{ amount_minor: number }>(
      'SELECT amount_minor FROM transactions WHERE id = ?',
      [tx.id]
    );
    expect(row?.amount_minor).toBe(MAX_AMOUNT_MINOR);
  });

  it('rejects editing an entry above the ceiling and leaves it unchanged', async () => {
    const tx = await createTransaction(input(5000));
    await expect(updateTransaction(tx.id, input(MAX_AMOUNT_MINOR + 100))).rejects.toThrow('too large');
    const row = await mockTestDb.getFirstAsync<{ amount_minor: number }>(
      'SELECT amount_minor FROM transactions WHERE id = ?',
      [tx.id]
    );
    expect(row?.amount_minor).toBe(5000);
  });

  it('still rejects zero, negative and non-finite amounts with the original message', async () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      await expect(createTransaction(input(bad))).rejects.toThrow('Amount must be a positive number');
    }
  });
});
