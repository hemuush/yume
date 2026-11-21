/** The + button's way of adding (form or chat) on real SQLite: it defaults to the form, and survives a restart. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { getAddStyle, resetSettingsCache, setAddStyle } from '@/db/settings';

beforeEach(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
});

it('is the form until the chat is chosen', async () => {
  expect(await getAddStyle()).toBe('form');
});

it('keeps the choice, and reads it again after the cache is dropped (a restart)', async () => {
  await setAddStyle('chat');
  expect(await getAddStyle()).toBe('chat');
  resetSettingsCache();
  expect(await getAddStyle()).toBe('chat');
  await setAddStyle('form');
  resetSettingsCache();
  expect(await getAddStyle()).toBe('form');
});

it('reads anything else stored (an old or damaged value) as the form, and refuses to store one', async () => {
  await mockTestDb.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('add_style', 'voice')`);
  expect(await getAddStyle()).toBe('form');
  await expect(setAddStyle('voice' as never)).rejects.toThrow();
});
