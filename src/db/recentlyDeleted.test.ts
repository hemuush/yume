/**
 * Recently deleted: a deleted entry waits 30 days and can be put back
 * exactly as it was; Undo takes it off the list; taking back a "Log again"
 * never lands here; an entry whose account is gone can't be restored; and
 * restoring a backup clears the list. All figures are made up.
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
  deleteTransaction,
  restoreTransaction,
  listTransactions,
} from '@/db/ledger';
import {
  listDeletedEntries,
  countDeletedEntries,
  restoreDeletedEntry,
  emptyDeletedEntries,
  purgeExpiredDeletedEntries,
  daysLeftOf,
  KEEP_DAYS,
} from './recentlyDeleted';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';

let bank: string;
let food: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

beforeEach(async () => {
  for (const table of ['deleted_entries', 'transactions', 'categories', 'accounts']) {
    await mockTestDb.runAsync(`DELETE FROM ${table}`);
  }
  bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
});

async function lunch() {
  return createTransaction({
    type: 'expense',
    accountId: bank,
    categoryId: food,
    amountMinor: 18_000,
    date: '2026-09-26',
    note: 'Lunch',
  });
}

describe('Recently deleted', () => {
  it('keeps a deleted entry, and restores it exactly as it was', async () => {
    const tx = await lunch();
    await deleteTransaction(tx.id);
    expect(await listTransactions()).toHaveLength(0);
    const kept = await listDeletedEntries();
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ id: tx.id, amountMinor: 18_000, note: 'Lunch', blockedReason: null });
    expect(await countDeletedEntries()).toBe(1);

    await restoreDeletedEntry(tx.id);
    const back = await listTransactions();
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ id: tx.id, amountMinor: 18_000, date: '2026-09-26', accountId: bank });
    expect(await countDeletedEntries()).toBe(0);
  });

  it('Undo takes it off the list', async () => {
    const tx = await lunch();
    const snapshot = await deleteTransaction(tx.id);
    await restoreTransaction(snapshot);
    expect(await countDeletedEntries()).toBe(0);
    expect(await listTransactions()).toHaveLength(1);
  });

  it('taking back a "Log again" never lands here', async () => {
    const tx = await lunch();
    await deleteTransaction(tx.id, { keep: false });
    expect(await countDeletedEntries()).toBe(0);
  });

  it('clears entries older than 30 days as the app opens', async () => {
    const tx = await lunch();
    await deleteTransaction(tx.id);
    await purgeExpiredDeletedEntries(mockTestDb, new Date(Date.now() + (KEEP_DAYS - 1) * 86_400_000));
    expect(await countDeletedEntries()).toBe(1);
    await purgeExpiredDeletedEntries(mockTestDb, new Date(Date.now() + (KEEP_DAYS + 1) * 86_400_000));
    expect(await countDeletedEntries()).toBe(0);
  });

  it("won't restore an entry whose account is gone, and says why", async () => {
    const tx = await lunch();
    await deleteTransaction(tx.id);
    await mockTestDb.runAsync('DELETE FROM accounts WHERE id = ?', [bank]);
    const [entry] = await listDeletedEntries();
    expect(entry.blockedReason).toBe('Its account no longer exists');
  });

  it('can be emptied for good', async () => {
    await deleteTransaction((await lunch()).id);
    await deleteTransaction((await lunch()).id);
    await emptyDeletedEntries();
    expect(await countDeletedEntries()).toBe(0);
  });

  it('is left out of backups, and a restore clears it', async () => {
    const keepMe = await lunch();
    const gone = await lunch();
    await deleteTransaction(gone.id);
    const snapshot = await buildBackupSnapshot();
    expect(Object.keys(snapshot.tables)).not.toContain('deleted_entries');
    expect(await countDeletedEntries()).toBe(1);
    await restoreFromSnapshot(snapshot);
    expect(await countDeletedEntries()).toBe(0);
    expect((await listTransactions()).map((t) => t.id)).toEqual([keepMe.id]);
  });

  it('counts days left down from 30, never below 1', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(daysLeftOf('2026-09-27T12:00:00Z', now)).toBe(30);
    expect(daysLeftOf('2026-09-20T12:00:00Z', now)).toBe(23);
    expect(daysLeftOf('2026-08-01T12:00:00Z', now)).toBe(1);
  });
});
