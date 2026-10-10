import { createRealDataTestDb } from '@/test-support/realDataTestDb';
const mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
import { CREATE_TABLES_SQL } from '@/db/schema';
import { getHideWidgetValues, setHideWidgetValues, resetSettingsCache } from '@/db/settings';
import { renderWidgetByName } from './registry';
beforeEach(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await mockDb.runAsync('DELETE FROM settings');
  resetSettingsCache();
});
it('persists privacy and masks every financial widget without querying its ledger', async () => {
  expect(await getHideWidgetValues()).toBe(false);
  await setHideWidgetValues(true);
  resetSettingsCache();
  expect(await getHideWidgetValues()).toBe(true);
  for (const name of ['ThisMonth', 'Suu', 'NextDue', 'Accounts'] as const) {
    const element = await renderWidgetByName(name);
    expect(element.props.clickAction).toBe('OPEN_APP');
    expect(JSON.stringify(element)).toContain('Widget details hidden');
    expect(JSON.stringify(element)).not.toContain('₹');
  }
});
it('retains the cached preference if persistence fails', async () => {
  await setHideWidgetValues(true);
  const write = jest.spyOn(mockDb, 'runAsync').mockRejectedValueOnce(new Error('disk full'));
  await expect(setHideWidgetValues(false)).rejects.toThrow('disk full');
  expect(await getHideWidgetValues()).toBe(true);
  write.mockRestore();
});

it('keeps Quick Add functional when financial widget details are hidden', async () => {
  await setHideWidgetValues(true);
  const { QuickAddWidget } = require('./QuickAddWidget');
  expect((await renderWidgetByName('QuickAdd')).type).toBe(QuickAddWidget);
});
it('hides financial details when the privacy setting cannot be read', async () => {
  const read = jest.spyOn(mockDb, 'getFirstAsync').mockRejectedValueOnce(new Error('unavailable'));
  expect(JSON.stringify(await renderWidgetByName('Accounts'))).toContain('Widget details hidden');
  read.mockRestore();
});
