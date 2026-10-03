/**
 * Schema versioning on real SQLite: an unversioned DB is stamped, steps run once and in order, a failing step
 * leaves nothing half-applied (one transaction, as in initDb), and a newer app's DB is never touched.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { runMigrations, MIGRATIONS, VersionedMigration } from '@/db/client';

async function freshDb() {
  const db = createRealDataTestDb();
  await db.execAsync(CREATE_TABLES_SQL);
  return db;
}

const versionOf = async (db: Awaited<ReturnType<typeof freshDb>>) =>
  (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;

describe('schema versioning', () => {
  it('has no numbered steps yet, so the baseline is version 1', () => {
    expect(MIGRATIONS).toHaveLength(0);
  });

  it('stamps an unversioned database with the baseline and stays there on every later launch', async () => {
    const db = await freshDb();
    expect(await versionOf(db)).toBe(0);
    await runMigrations(db);
    expect(await versionOf(db)).toBe(1);
    await runMigrations(db);
    expect(await versionOf(db)).toBe(1);
  });

  it('runs each numbered step once, in version order, and records the highest', async () => {
    const db = await freshDb();
    const ran: number[] = [];
    const steps: VersionedMigration[] = [
      { version: 3, run: async () => void ran.push(3) },
      { version: 2, run: async () => void ran.push(2) },
    ];
    await runMigrations(db, steps);
    expect(ran).toEqual([2, 3]);
    expect(await versionOf(db)).toBe(3);

    await runMigrations(db, steps);
    expect(ran).toEqual([2, 3]);
  });

  it('runs only the steps newer than what the database already has', async () => {
    const db = await freshDb();
    await db.execAsync('PRAGMA user_version = 2');
    const ran: number[] = [];
    await runMigrations(db, [
      { version: 2, run: async () => void ran.push(2) },
      { version: 3, run: async () => void ran.push(3) },
    ]);
    expect(ran).toEqual([3]);
    expect(await versionOf(db)).toBe(3);
  });

  it('rolls a failing step back with its version stamp when run inside a transaction', async () => {
    const db = await freshDb();
    const failing: VersionedMigration[] = [
      {
        version: 2,
        run: async (tx) => {
          await tx.execAsync('CREATE TABLE half_done (id INTEGER)');
          throw new Error('step failed');
        },
      },
    ];
    await expect(db.withTransactionAsync((tx) => runMigrations(tx, failing))).rejects.toThrow('step failed');
    expect(await versionOf(db)).toBe(0);
    const table = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'half_done'");
    expect(table).toBeNull();
  });

  it('never lowers the version of a database written by a newer app, and does not re-run anything', async () => {
    const db = await freshDb();
    await db.execAsync('PRAGMA user_version = 7');
    const run = jest.fn(async () => {});
    await runMigrations(db, [{ version: 4, run }]);
    expect(run).not.toHaveBeenCalled();
    expect(await versionOf(db)).toBe(7);
  });
});
