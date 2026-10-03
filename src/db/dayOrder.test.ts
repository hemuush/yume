/**
 * Dragging entries into the order you want, in a real database: the order is
 * saved per day, new entries land on top of a hand-arranged day, other days
 * are untouched, and moving an entry to another date drops its old place.
 * All figures are made up.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  updateTransaction,
  listTransactions,
  setDayOrder,
} from '@/db/ledger';

let bank: string;
let food: string;

const add = async (date: string, amountMinor: number) =>
  (await createTransaction({ type: 'expense', accountId: bank, categoryId: food, amountMinor, date })).id;
const idsOn = async (date: string) =>
  (await listTransactions({ fromDate: date, toDate: date })).map((t) => t.id);

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

beforeEach(async () => {
  for (const table of ['deleted_entries', 'transactions', 'categories', 'accounts']) {
    await mockTestDb.runAsync(`DELETE FROM ${table}`);
  }
  bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1_000_000 })
  ).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
});

describe('setDayOrder', () => {
  it('saves the order you arranged, top to bottom', async () => {
    const a = await add('2026-10-01', 100);
    const b = await add('2026-10-01', 200);
    const c = await add('2026-10-01', 300);
    await setDayOrder('2026-10-01', [b, c, a]);
    expect(await idsOn('2026-10-01')).toEqual([b, c, a]);
    await setDayOrder('2026-10-01', [a, b, c]);
    expect(await idsOn('2026-10-01')).toEqual([a, b, c]);
  });

  it('leaves other days alone and ignores an id from another day', async () => {
    const a = await add('2026-10-01', 100);
    const b = await add('2026-10-01', 200);
    const other = await add('2026-10-02', 300);
    await setDayOrder('2026-10-01', [b, other, a]);
    const all = await listTransactions({});
    expect(all.find((t) => t.id === other)?.dayRank).toBeNull();
    expect(await idsOn('2026-10-01')).toEqual([b, a]);
  });

  it('puts an entry added later above a hand-arranged day', async () => {
    const a = await add('2026-10-01', 100);
    const b = await add('2026-10-01', 200);
    await setDayOrder('2026-10-01', [a, b]);
    const fresh = await add('2026-10-01', 300);
    expect(await idsOn('2026-10-01')).toEqual([fresh, a, b]);
  });

  it('forgets the place when an entry moves to another date, and keeps it on any other edit', async () => {
    const a = await add('2026-10-01', 100);
    const b = await add('2026-10-01', 200);
    await setDayOrder('2026-10-01', [a, b]);
    const edit = (id: string, date: string, amountMinor: number) =>
      updateTransaction(id, { type: 'expense', accountId: bank, categoryId: food, amountMinor, date });
    expect((await edit(a, '2026-10-01', 150)).dayRank).toBe(0);
    expect((await edit(a, '2026-10-03', 150)).dayRank).toBeNull();
  });
});
