/**
 * The app-icon shortcuts (plugins/withAppShortcuts.js) open Add with a type
 * Add actually understands, through the app's own scheme — and the plugin is
 * registered in app.json, so a build really includes them.
 */
import { isTxType } from '@/features/add/addEntry';

const { SHORTCUTS, shortcutsXml } = require('../../plugins/withAppShortcuts');
const appJson = require('../../app.json');

describe('app shortcuts', () => {
  it('are registered as a config plugin', () => {
    expect(appJson.expo.plugins).toContain('./plugins/withAppShortcuts');
  });

  it('offer Add expense, Add income and Transfer, each a type Add accepts', () => {
    expect(SHORTCUTS.map((s: { label: string }) => s.label)).toEqual([
      'Add expense',
      'Add income',
      'Transfer',
    ]);
    for (const s of SHORTCUTS) expect(isTxType(s.type)).toBe(true);
  });

  it("link to Add through the app's own scheme and main activity", () => {
    const xml: string = shortcutsXml(appJson.expo.android.package, appJson.expo.scheme);
    expect(xml).toContain('android:data="yume://add-transaction?type=expense"');
    expect(xml).toContain('android:targetClass="com.yume.app.MainActivity"');
    expect(xml.match(/<shortcut\b/g)).toHaveLength(3);
  });
});
