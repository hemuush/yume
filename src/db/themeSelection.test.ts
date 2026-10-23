import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));

import { getAccentColor, getThemeId, resetSettingsCache, setThemeSelection } from './settings';

beforeAll(async () => {
  await mockDb.execAsync('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
});

beforeEach(async () => {
  await mockDb.execAsync('DROP TRIGGER IF EXISTS reject_theme_accent; DELETE FROM settings;');
  resetSettingsCache();
  await setThemeSelection('yume', '#8FCBFF');
});

it('keeps both stored settings and caches unchanged when the accent write fails', async () => {
  await mockDb.execAsync(`CREATE TRIGGER reject_theme_accent BEFORE INSERT ON settings
    WHEN NEW.key = 'accent_color' AND NEW.value = '#A6B4F2'
    BEGIN SELECT RAISE(ABORT, 'Injected accent failure'); END;`);
  await expect(setThemeSelection('hollowViolet', '#A6B4F2')).rejects.toThrow('Injected accent failure');
  expect(await getThemeId()).toBe('yume');
  expect(await getAccentColor()).toBe('#8FCBFF');
  expect(await mockDb.getAllAsync('SELECT key, value FROM settings ORDER BY key')).toEqual([
    { key: 'accent_color', value: '#8FCBFF' },
    { key: 'theme_id', value: 'yume' },
  ]);
  await mockDb.execAsync('DROP TRIGGER reject_theme_accent');
  await setThemeSelection('hollowViolet', '#A6B4F2');
  expect(await getThemeId()).toBe('hollowViolet');
  expect(await getAccentColor()).toBe('#A6B4F2');
});

it('keeps a complete final selection when theme writes overlap', async () => {
  await Promise.all([
    setThemeSelection('hollowViolet', '#A6B4F2'),
    setThemeSelection('corpsGreen', '#AEDABB'),
  ]);
  resetSettingsCache();
  expect(await getThemeId()).toBe('corpsGreen');
  expect(await getAccentColor()).toBe('#AEDABB');
});

it('rejects an invalid accent without changing the current selection', async () => {
  await expect(setThemeSelection('corpsGreen', 'invalid')).rejects.toThrow('valid theme');
  expect(await getThemeId()).toBe('yume');
  expect(await getAccentColor()).toBe('#8FCBFF');
});
