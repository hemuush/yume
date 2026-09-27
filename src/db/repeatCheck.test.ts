/**
 * The Add screen's two lookups, against a real SQLite engine:
 *   - findRecentRepeat: an identical entry saved in the last 30 minutes
 *   - getLastAccountForCategory: the account a category was last used with
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
import {
  createAccount,
  createCategory,
  createTransaction,
  archiveAccount,
  findRecentRepeat,
  getLastAccountForCategory,
} from '@/db/ledger';

const NOW = new Date('2026-09-26T08:00:00Z');
/** Backdates a transaction's created_at to `minutesAgo` before NOW. */
const savedMinutesAgo = (id: string, minutesAgo: number) =>
  mockTestDb.runAsync('UPDATE transactions SET created_at = ? WHERE id = ?', [
    new Date(NOW.getTime() - minutesAgo * 60_000).toISOString().slice(0, 19).replace('T', ' '),
    id,
  ]);

let bank: string;
let cash: string;
let savings: string;
let food: string;
let travel: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
  cash = (await createAccount({ name: 'Cash', type: 'cash', currency: 'INR', openingBalanceMinor: 0 })).id;
  savings = (
    await createAccount({ name: 'Savings', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })
  ).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  travel = (await createCategory({ name: 'Travel', kind: 'expense' })).id;
});

describe('findRecentRepeat', () => {
  const lunch = () => ({
    type: 'expense' as const,
    accountId: bank,
    toAccountId: null,
    categoryId: food,
    amountMinor: 5000,
    date: '2026-09-26',
  });

  it('finds an identical entry saved a few minutes ago, and says when', async () => {
    const tx = await createTransaction({ ...lunch() });
    await savedMinutesAgo(tx.id, 8);
    expect(await findRecentRepeat(lunch(), NOW)).toEqual({ savedAt: '2026-09-26T07:52:00Z' });
  });

  it('ignores anything that differs in amount, account, category, type or date', async () => {
    for (const change of [
      { amountMinor: 5100 },
      { accountId: cash },
      { categoryId: travel },
      { date: '2026-09-25' },
    ]) {
      expect(await findRecentRepeat({ ...lunch(), ...change }, NOW)).toBeNull();
    }
  });

  it('only looks back 30 minutes', async () => {
    const tx = await createTransaction({ ...lunch(), amountMinor: 7700 });
    await savedMinutesAgo(tx.id, 31);
    expect(await findRecentRepeat({ ...lunch(), amountMinor: 7700 }, NOW)).toBeNull();
    await savedMinutesAgo(tx.id, 29);
    expect(await findRecentRepeat({ ...lunch(), amountMinor: 7700 }, NOW)).not.toBeNull();
  });

  it('matches transfers on both accounts', async () => {
    const move = {
      type: 'transfer' as const,
      accountId: savings,
      toAccountId: bank,
      categoryId: null,
      amountMinor: 200000,
      date: '2026-09-26',
    };
    const tx = await createTransaction(move);
    await savedMinutesAgo(tx.id, 2);
    expect(await findRecentRepeat(move, NOW)).not.toBeNull();
    expect(await findRecentRepeat({ ...move, toAccountId: cash }, NOW)).toBeNull();
  });
});

describe('getLastAccountForCategory', () => {
  it('returns the account the category was most recently used with', async () => {
    const tx1 = await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: travel,
      amountMinor: 100,
      date: '2026-09-10',
    });
    const tx2 = await createTransaction({
      type: 'expense',
      accountId: cash,
      categoryId: travel,
      amountMinor: 100,
      date: '2026-09-20',
    });
    expect(tx1.id).not.toBe(tx2.id);
    expect(await getLastAccountForCategory(travel)).toBe(cash);
  });

  it('skips archived accounts, and returns null for a category never used', async () => {
    await archiveAccount(cash);
    expect(await getLastAccountForCategory(travel)).toBe(bank);
    const unused = (await createCategory({ name: 'Gifts', kind: 'expense' })).id;
    expect(await getLastAccountForCategory(unused)).toBeNull();
  });
});
