/**
 * restoreFromSnapshot against a real SQLite engine: a valid snapshot must
 * round-trip with nothing reported skipped, and a snapshot carrying keys
 * that aren't real columns (an older/newer schema, or a hand-edited file)
 * must still restore every real column while naming the dropped keys in
 * `skippedColumns` — so the Backup screen can tell the user a partial
 * restore happened instead of it passing silently for a complete one.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { buildBackupSnapshot, restoreFromSnapshot, BACKUP_FORMAT_VERSION } from '@/lib/backup';
import { createAccount, createCategory, createTransaction, listTransactions } from '@/db/ledger';

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

describe('restoreFromSnapshot', () => {
  it('round-trips a real snapshot with nothing skipped', async () => {
    const account = await createAccount({
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const cat = await createCategory({ name: 'Food', kind: 'expense' });
    await createTransaction({
      type: 'expense',
      accountId: account.id,
      categoryId: cat.id,
      amountMinor: 12300,
      date: '2026-02-01',
    });

    const snapshot = await buildBackupSnapshot();
    const result = await restoreFromSnapshot(snapshot);

    expect(result.skippedColumns).toEqual([]);
    const txs = await listTransactions({ limit: 100 });
    expect(txs).toHaveLength(1);
    expect(txs[0].amountMinor).toBe(12300);
  });

  it('restores every real column but reports keys that are not columns', async () => {
    const base = await buildBackupSnapshot();
    const snapshot = {
      ...base,
      formatVersion: BACKUP_FORMAT_VERSION,
      tables: {
        ...base.tables,
        transactions: base.tables.transactions.map((t: any) => ({
          ...t,
          legacy_notes_field: 'dropped by a schema change',
          another_ghost: 1,
        })),
      },
    };

    const result = await restoreFromSnapshot(snapshot);

    expect(result.skippedColumns).toEqual(['transactions.another_ghost', 'transactions.legacy_notes_field']);
    const txs = await listTransactions({ limit: 100 });
    expect(txs).toHaveLength(1);
    expect(txs[0].amountMinor).toBe(12300); // the real columns still came through
  });

  it('rejects a snapshot from a newer format version', async () => {
    const base = await buildBackupSnapshot();
    await expect(restoreFromSnapshot({ ...base, formatVersion: BACKUP_FORMAT_VERSION + 1 })).rejects.toThrow(
      /newer version/
    );
  });
});
