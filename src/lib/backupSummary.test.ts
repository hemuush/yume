/**
 * Backup summaries as the restore preview shows them: a file's entries, latest date, accounts and loans;
 * the same for the phone; and how many entries were saved after a backup.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import {
  summarizeSnapshot,
  getCurrentSummary,
  countEntriesSavedAfter,
  isTooLargeForBackup,
  MAX_BACKUP_FILE_BYTES,
} from './backup';

describe('summarizeSnapshot', () => {
  it("counts a backup's entries, accounts and loans, and finds its latest entry", () => {
    const snapshot = {
      formatVersion: 1,
      exportedAt: '2026-09-25T18:28:02Z',
      tables: {
        transactions: [{ date: '2026-09-24' }, { date: '2026-09-25' }, { date: '2026-01-02' }],
        accounts: [{}, {}],
        loans: [{}],
      },
    };
    expect(summarizeSnapshot(snapshot)).toEqual({
      entries: 3,
      lastEntryDate: '2026-09-25',
      accounts: 2,
      loans: 1,
    });
  });

  it("says a file that isn't a Yume backup has nothing to summarise", () => {
    expect(summarizeSnapshot({ hello: 'world' })).toBeNull();
    expect(summarizeSnapshot(null)).toBeNull();
  });
});

describe('the phone right now', () => {
  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const bank = (
      await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    const early = await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 100,
      date: '2026-09-20',
    });
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 100,
      date: '2026-09-26',
    });
    await mockTestDb.runAsync(`UPDATE transactions SET created_at = '2026-09-20 10:00:00' WHERE id = ?`, [
      early.id,
    ]);
    await mockTestDb.runAsync(`UPDATE transactions SET created_at = '2026-09-26 03:00:00' WHERE id <> ?`, [
      early.id,
    ]);
  });

  it('summarises what is on the phone', async () => {
    expect(await getCurrentSummary()).toEqual({
      entries: 2,
      lastEntryDate: '2026-09-26',
      accounts: 1,
      loans: 0,
    });
  });

  it('counts the entries saved after a backup was made', async () => {
    expect(await countEntriesSavedAfter('2026-09-25T18:28:02Z')).toBe(1);
    expect(await countEntriesSavedAfter('2026-09-01T00:00:00Z')).toBe(2);
    expect(await countEntriesSavedAfter('2026-09-27T00:00:00Z')).toBe(0);
  });
});

describe('isTooLargeForBackup', () => {
  it('lets a normal file through and rejects an oversized one', () => {
    expect(isTooLargeForBackup(40 * 1024 * 1024)).toBe(false);
    expect(isTooLargeForBackup(MAX_BACKUP_FILE_BYTES)).toBe(false);
    expect(isTooLargeForBackup(MAX_BACKUP_FILE_BYTES + 1)).toBe(true);
  });

  it('does not block a file whose size is unknown', () => {
    expect(isTooLargeForBackup(undefined)).toBe(false);
    expect(isTooLargeForBackup(null)).toBe(false);
  });
});
