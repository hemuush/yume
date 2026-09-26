/**
 * getAccountFlow against a real SQLite engine — same reasoning as
 * reportsLiveQueries.test.ts.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, getAccountFlow } from '@/db/ledger';

describe('getAccountFlow', () => {
  let bankId: string;
  let savingsId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    bankId = (
      await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 500000 })
    ).id;
    savingsId = (await createAccount({ name: 'Pot', type: 'savings', currency: 'INR' })).id;
    const salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
    const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;

    // September, in range
    await createTransaction({
      type: 'income',
      accountId: bankId,
      categoryId: salary,
      amountMinor: 1000000,
      date: '2026-09-01',
    });
    await createTransaction({
      type: 'expense',
      accountId: bankId,
      categoryId: food,
      amountMinor: 20000,
      date: '2026-09-10',
    });
    await createTransaction({
      type: 'transfer',
      accountId: bankId,
      toAccountId: savingsId,
      amountMinor: 300000,
      date: '2026-09-12',
    });
    await createTransaction({
      type: 'transfer',
      accountId: savingsId,
      toAccountId: bankId,
      amountMinor: 50000,
      date: '2026-09-30',
    });
    // Outside the range on both sides
    await createTransaction({
      type: 'expense',
      accountId: bankId,
      categoryId: food,
      amountMinor: 99900,
      date: '2026-08-31',
    });
    await createTransaction({
      type: 'income',
      accountId: bankId,
      categoryId: salary,
      amountMinor: 99900,
      date: '2026-10-01',
    });
  });

  const september = { start: '2026-09-01', end: '2026-09-30' };

  it('counts income and transfers in as in, expenses and transfers out as out', async () => {
    expect(await getAccountFlow(bankId, september)).toEqual({ inMinor: 1050000, outMinor: 320000 });
  });

  it('sees the other side of each transfer from the destination account', async () => {
    expect(await getAccountFlow(savingsId, september)).toEqual({ inMinor: 300000, outMinor: 50000 });
  });

  it('ignores the opening balance and anything outside the range', async () => {
    expect(await getAccountFlow(bankId, { start: '2026-07-01', end: '2026-07-31' })).toEqual({
      inMinor: 0,
      outMinor: 0,
    });
  });
});
