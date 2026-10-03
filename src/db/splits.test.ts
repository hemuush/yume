/**
 * Split payments in a real DB: parts get their own categories and share one id, edits replace parts, a part
 * can't be deleted alone, deleting takes the whole payment (Undo restores every part), Tidy up skips parts.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
// Only the native modules client.ts touches at import time: runMigrations runs for real.
jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('@/db/client', () => ({
  ...jest.requireActual('@/db/client'),
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { runMigrations } from '@/db/client';
import {
  createAccount,
  createCategory,
  createTransaction,
  listTransactions,
  deleteTransaction,
  getAccountBalance,
} from '@/db/ledger';
import { saveSplit, getSplitParts, deleteSplit, restoreSplit, splitProblem } from './splits';
import { countDeletedEntries } from './recentlyDeleted';
import { getTidyUpReport } from './tidyUp';

let bank: string;
let groceries: string;
let household: string;

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
  groceries = (await createCategory({ name: 'Groceries', kind: 'expense' })).id;
  household = (await createCategory({ name: 'Household', kind: 'expense' })).id;
});

const dmart = (
  parts = [
    { categoryId: groceries, amountMinor: 120_000 },
    { categoryId: household, amountMinor: 65_000 },
  ]
) => saveSplit({ accountId: bank, date: '2026-09-27', note: 'DMart', parts });

describe('split payments', () => {
  it('puts each part in its own category, sharing one id, with the whole total on each', async () => {
    const splitId = await dmart();
    const rows = await listTransactions();
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.splitId))).toEqual(new Set([splitId]));
    expect(rows.map((r) => r.splitTotalMinor)).toEqual([185_000, 185_000]);
    expect(rows.map((r) => r.note)).toEqual(['DMart', 'DMart']);
    const inGroceries = await listTransactions({ categoryId: groceries });
    expect(inGroceries.map((r) => r.amountMinor)).toEqual([120_000]);
    expect(await getAccountBalance(bank)).toBe(1_000_000 - 185_000);
  });

  it('lists the parts biggest first', async () => {
    const splitId = await dmart();
    expect((await getSplitParts(splitId)).map((p) => p.amountMinor)).toEqual([120_000, 65_000]);
  });

  it('editing replaces the parts, keeping the split id, and never lands in Recently deleted', async () => {
    const splitId = await dmart();
    await saveSplit({
      splitId,
      accountId: bank,
      date: '2026-09-27',
      note: 'DMart',
      parts: [
        { categoryId: groceries, amountMinor: 100_000 },
        { categoryId: household, amountMinor: 50_000 },
        { categoryId: household, amountMinor: 35_000 },
      ],
    });
    const parts = await getSplitParts(splitId);
    expect(parts.map((p) => p.amountMinor)).toEqual([100_000, 50_000, 35_000]);
    expect(await listTransactions()).toHaveLength(3);
    expect(await countDeletedEntries()).toBe(0);
  });

  it('splitting an ordinary entry replaces it with the parts', async () => {
    const plain = await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: groceries,
      amountMinor: 185_000,
      date: '2026-09-27',
    });
    await saveSplit({
      replacesEntryId: plain.id,
      accountId: bank,
      date: '2026-09-27',
      parts: [
        { categoryId: groceries, amountMinor: 120_000 },
        { categoryId: household, amountMinor: 65_000 },
      ],
    });
    const rows = await listTransactions();
    expect(rows.map((r) => r.id)).not.toContain(plain.id);
    expect(rows.map((r) => r.amountMinor).sort()).toEqual([120_000, 65_000].sort());
    expect(await getAccountBalance(bank)).toBe(1_000_000 - 185_000);
  });

  it('refuses a part deleted on its own', async () => {
    await dmart();
    const [part] = await listTransactions();
    await expect(deleteTransaction(part.id)).rejects.toThrow('part of a split');
  });

  it('deletes the whole payment into Recently deleted, and Undo brings every part back', async () => {
    const splitId = await dmart();
    const snapshots = await deleteSplit(splitId);
    expect(await listTransactions()).toHaveLength(0);
    expect(await countDeletedEntries()).toBe(2);
    await restoreSplit(snapshots);
    expect(await listTransactions()).toHaveLength(2);
    expect(await countDeletedEntries()).toBe(0);
  });

  it('turns away fewer than 2 or more than 6 parts, a missing category, or a zero amount', async () => {
    const one = [{ categoryId: groceries, amountMinor: 100 }];
    expect(splitProblem(one)).toMatch('at least 2');
    expect(splitProblem(Array(7).fill(one[0]))).toMatch('at most 6');
    expect(splitProblem([...one, { categoryId: '', amountMinor: 100 }])).toMatch('category');
    expect(splitProblem([...one, { categoryId: household, amountMinor: 0 }])).toMatch('above zero');
    await expect(dmart(one)).rejects.toThrow('at least 2');
    expect(await listTransactions()).toHaveLength(0);
  });

  it('Tidy up never calls two identical splits a repeat', async () => {
    await dmart();
    await dmart();
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: groceries,
      amountMinor: 5_000,
      date: '2026-09-27',
    });
    const report = await getTidyUpReport();
    expect(report.repeats).toHaveLength(0);
  });

  it('adds the column and its index to an older database that lacks them', async () => {
    const older = createRealDataTestDb();
    await older.execAsync(CREATE_TABLES_SQL);
    await older.execAsync('ALTER TABLE transactions DROP COLUMN split_id');
    await runMigrations(older);
    const cols = await older.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
    expect(cols.map((c) => c.name)).toContain('split_id');
    const indexes = await older.getAllAsync<{ name: string }>('PRAGMA index_list(transactions)');
    expect(indexes.map((x) => x.name)).toContain('idx_transactions_split');
  });
});
