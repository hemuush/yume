/** One value update per account per day: old duplicates are merged on upgrade, and a second can't be inserted. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { runMigrations } from '@/db/client';

async function setup() {
  const db = createRealDataTestDb();
  await db.execAsync(CREATE_TABLES_SQL);
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, currency) VALUES ('a1', 'Test Fund', 'savings', 'INR')`
  );
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, currency) VALUES ('a2', 'Test Other', 'savings', 'INR')`
  );
  return db;
}
const insert = (
  db: Awaited<ReturnType<typeof setup>>,
  id: string,
  account: string,
  date: string,
  value: number
) =>
  db.runAsync('INSERT INTO account_valuations (id, account_id, date, value_minor) VALUES (?, ?, ?, ?)', [
    id,
    account,
    date,
    value,
  ]);

describe('account_valuations uniqueness', () => {
  it('keeps the newest of any duplicates already on an install, and leaves other days and accounts alone', async () => {
    const db = await setup();
    await insert(db, 'old', 'a1', '2026-01-01', 100);
    await insert(db, 'new', 'a1', '2026-01-01', 200);
    await insert(db, 'other-day', 'a1', '2026-01-02', 300);
    await insert(db, 'other-account', 'a2', '2026-01-01', 400);
    await runMigrations(db);
    const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM account_valuations ORDER BY id');
    expect(rows.map((r) => r.id)).toEqual(['new', 'other-account', 'other-day']);
  });

  it('refuses a second value update for the same account and day afterwards', async () => {
    const db = await setup();
    await runMigrations(db);
    await insert(db, 'one', 'a1', '2026-01-01', 100);
    await expect(insert(db, 'two', 'a1', '2026-01-01', 200)).rejects.toThrow(/UNIQUE/i);
    await insert(db, 'three', 'a1', '2026-01-02', 200);
  });

  it('is safe to run on every launch', async () => {
    const db = await setup();
    await insert(db, 'one', 'a1', '2026-01-01', 100);
    await runMigrations(db);
    await runMigrations(db);
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM account_valuations');
    expect(n?.n).toBe(1);
  });
});
