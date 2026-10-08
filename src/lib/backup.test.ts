/**
 * restoreFromSnapshot on a real SQLite engine: a valid snapshot round-trips with nothing skipped; keys that
 * aren't real columns are dropped and named in `skippedColumns` so a partial restore is never silent.
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

  it('restores a file with two value updates for one account and day, keeping the later one', async () => {
    await mockTestDb.execAsync(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_account_valuations_unique_day ON account_valuations(account_id, date)'
    );
    const base = await buildBackupSnapshot();
    const accountId = (base.tables.accounts as any[])[0].id;
    const row = (id: string, value: number) => ({
      id,
      account_id: accountId,
      date: '2026-03-01',
      value_minor: value,
    });
    const snapshot = {
      ...base,
      tables: { ...base.tables, account_valuations: [row('first', 100), row('second', 200)] },
    };

    await restoreFromSnapshot(snapshot);

    const rows = await mockTestDb.getAllAsync<{ id: string; value_minor: number }>(
      'SELECT id, value_minor FROM account_valuations'
    );
    expect(rows).toEqual([{ id: 'second', value_minor: 200 }]);
  });

  it('names the tables an older backup has no section for, which the restore empties', async () => {
    await mockTestDb.runAsync("INSERT INTO people (id, name) VALUES ('p1', 'Asha')");
    const base = await buildBackupSnapshot();
    const { people: _people, person_ledger_entries: _ledger, ...older } = base.tables;

    const result = await restoreFromSnapshot({ ...base, tables: older });

    expect(result.emptiedTables).toEqual(['people']);
  });

  it('rejects a file whose amounts are not whole numbers, changing nothing', async () => {
    const base = await buildBackupSnapshot();
    const before = await listTransactions({ limit: 100 });
    const damaged = {
      ...base,
      tables: {
        ...base.tables,
        transactions: (base.tables.transactions as any[]).map((t) => ({ ...t, amount_minor: 'abc' })),
      },
    };

    await expect(restoreFromSnapshot(damaged)).rejects.toThrow(/isn't a number/);
    expect(await listTransactions({ limit: 100 })).toHaveLength(before.length);
  });
});
