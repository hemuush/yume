/** Launch repairs run once per database: a stamped one skips them, an unstamped one (older backup) gets them. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { REPAIRS_VERSION, runMigrations } from '@/db/client';

it('repairs an unstamped database, stamps it, and skips the repairs next launch', async () => {
  const db = createRealDataTestDb();
  await db.execAsync(CREATE_TABLES_SQL);
  await db.runAsync("INSERT INTO settings (key, value) VALUES ('theme_id', 'old')");

  await runMigrations(db);
  expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'theme_id'")).toBeNull();
  expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'repairs_version'")).toEqual({
    value: String(REPAIRS_VERSION),
  });

  // Stamped: the repair that clears this key no longer runs.
  await db.runAsync("INSERT INTO settings (key, value) VALUES ('theme_id', 'old')");
  await runMigrations(db);
  expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'theme_id'")).toEqual({
    value: 'old',
  });

  // A restored older backup carries no stamp: repaired again.
  await db.runAsync("DELETE FROM settings WHERE key = 'repairs_version'");
  await runMigrations(db);
  expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'theme_id'")).toBeNull();
});
