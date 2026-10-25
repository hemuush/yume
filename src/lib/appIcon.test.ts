/**
 * Theme-following launcher icon: which icon the settings call for, when the native switch is touched, and that
 * app.json's icon list, the packs and the generated art stay in step.
 */
import fs from 'fs';
import path from 'path';

const mockNative = { getIcon: jest.fn(), setIcon: jest.fn() };
jest.mock('expo', () => ({
  requireOptionalNativeModule: () => ({
    getIcon: (...a: unknown[]) => mockNative.getIcon(...a),
    setIcon: (...a: unknown[]) => mockNative.setIcon(...a),
  }),
}));
const mockFollows = jest.fn();
const mockThemeId = jest.fn();
jest.mock('@/db/settings', () => ({
  getThemeIconFollows: () => mockFollows(),
  getThemeId: () => mockThemeId(),
}));

import { APP_ICON_IDS, syncAppIcon, wantedAppIcon } from './appIcon';
import { THEMES } from '@/theme/themes';

const root = path.resolve(__dirname, '../..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const iconPlugin = appJson.expo.plugins.find(
  (p: unknown) => Array.isArray(p) && /withThemeAppIcons/.test(p[0])
);
const withThemeAppIcons = require('../../plugins/withThemeAppIcons');

beforeEach(() => {
  mockNative.setIcon.mockResolvedValue(undefined);
  mockFollows.mockResolvedValue(true);
  mockThemeId.mockResolvedValue('hollowViolet');
  mockNative.getIcon.mockReturnValue('yume');
});

describe('wantedAppIcon', () => {
  it('follows the pack only when the setting is on', () => {
    expect(wantedAppIcon(true, 'crimsonNight')).toBe('crimsonNight');
    expect(wantedAppIcon(false, 'crimsonNight')).toBe('yume');
  });
  it('falls back to Yume for a missing or unknown pack', () => {
    expect(wantedAppIcon(true, null)).toBe('yume');
    expect(wantedAppIcon(true, 'gone')).toBe('yume');
  });
});

describe('syncAppIcon', () => {
  it('switches to the theme icon when following', async () => {
    expect(await syncAppIcon()).toBe(true);
    expect(mockNative.setIcon).toHaveBeenCalledWith('hollowViolet', APP_ICON_IDS);
  });
  it('returns to Yume once the setting is off', async () => {
    mockFollows.mockResolvedValue(false);
    mockNative.getIcon.mockReturnValue('hollowViolet');
    expect(await syncAppIcon()).toBe(true);
    expect(mockNative.setIcon).toHaveBeenCalledWith('yume', APP_ICON_IDS);
  });
  it('leaves the launcher alone when it already matches', async () => {
    mockNative.getIcon.mockReturnValue('hollowViolet');
    expect(await syncAppIcon()).toBe(false);
    expect(mockNative.setIcon).not.toHaveBeenCalled();
  });
  it('does nothing when the current icon is unknown', async () => {
    mockNative.getIcon.mockReturnValue(null);
    expect(await syncAppIcon()).toBe(false);
    expect(mockNative.setIcon).not.toHaveBeenCalled();
  });
  it('swallows a native failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockNative.setIcon.mockRejectedValue(new Error('boom'));
    expect(await syncAppIcon()).toBe(false);
  });
});

describe('icon set', () => {
  it('has one icon per pack in app.json, Yume as the default', () => {
    const props = iconPlugin[1];
    expect(props.defaultId).toBe('yume');
    expect(props.icons.map((i: { id: string }) => i.id)).toEqual(THEMES.map((t) => t.id));
  });
  it('ships art for every non-default icon at the same size as the current icon', () => {
    const size = (file: string) => {
      const b = fs.readFileSync(path.join(root, file));
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };
    for (const i of iconPlugin[1].icons.filter((x: { id: string }) => x.id !== 'yume')) {
      expect(size(i.icon)).toEqual(size('assets/icon.png'));
      expect(size(i.foreground)).toEqual(size('assets/android-icon-foreground.png'));
    }
  });
});

describe('withThemeAppIcons manifest', () => {
  const manifest = () => ({
    manifest: {
      application: [
        {
          $: { 'android:name': '.MainApplication' },
          activity: [
            {
              $: { 'android:name': '.MainActivity' },
              'intent-filter': [
                {
                  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
                },
                {
                  action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
                  category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  type Alias = { $: Record<string, string> };
  const applied = () => {
    const m = manifest();
    withThemeAppIcons.applyAliases(m, iconPlugin[1]);
    return m.manifest.application[0] as unknown as {
      activity: { 'intent-filter': unknown[] }[];
      'activity-alias': Alias[];
    };
  };

  it('moves the launcher entry from MainActivity to the aliases, keeping its links', () => {
    const app = applied();
    expect(app.activity[0]['intent-filter']).toHaveLength(1);
    expect(app['activity-alias']).toHaveLength(THEMES.length);
  });
  it('enables only the default alias, all targeting MainActivity', () => {
    const enabled = applied()['activity-alias'].filter((a) => a.$['android:enabled'] === 'true');
    expect(enabled.map((a) => a.$['android:name'])).toEqual(['.IconYume']);
    for (const a of applied()['activity-alias']) expect(a.$['android:targetActivity']).toBe('.MainActivity');
  });
  it('is idempotent', () => {
    const m = manifest();
    withThemeAppIcons.applyAliases(m, iconPlugin[1]);
    withThemeAppIcons.applyAliases(m, iconPlugin[1]);
    expect(m.manifest.application[0]).toHaveProperty('activity-alias.length', THEMES.length);
  });
});

describe('theme launch resources', () => {
  it('pairs every launcher choice with a stable launch theme and preserves the base theme', () => {
    const base = { $: { name: 'Theme.App.SplashScreen', parent: 'Theme.SplashScreen' }, item: [] };
    const styles = { resources: { style: [base] } };
    withThemeAppIcons.applySplashStyles(styles, iconPlugin[1]);
    for (const icon of iconPlugin[1].icons) {
      const name = `Theme.App.SplashScreen.${withThemeAppIcons.pascal(icon.id)}`;
      const style = styles.resources.style.find((s) => s.$.name === name)!;
      expect(style.$.parent).toBe('Theme.App.SplashScreen');
      expect(style.item).toEqual(
        ['windowSplashScreenAnimatedIcon', 'android:windowSplashScreenAnimatedIcon'].map((name) => ({
          $: { name },
          _:
            icon.id === 'yume'
              ? '@drawable/splashscreen_logo'
              : `@drawable/splashscreen_${icon.id.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
        }))
      );
    }
    expect(styles.resources.style).toContain(base);
    expect(base.item).toEqual(
      ['windowSplashScreenAnimatedIcon', 'android:windowSplashScreenAnimatedIcon'].map((name) => ({
        $: { name },
        _: '@null',
      }))
    );
    const once = JSON.stringify(styles);
    withThemeAppIcons.applySplashStyles(styles, iconPlugin[1]);
    expect(JSON.stringify(styles)).toBe(once);
  });

  it('selects the native launch theme before Expo reads it, without duplicating the hook on prebuild', () => {
    const source =
      'override fun onCreate(savedInstanceState: Bundle?) {\n    SplashScreenManager.registerOnActivity(this)\n    super.onCreate(null)\n  }';
    const patched = withThemeAppIcons.applyLaunchThemeToActivity(source, iconPlugin[1]);
    expect(patched.indexOf('YumeAppIconModule.applyLaunchTheme')).toBeLessThan(
      patched.indexOf('SplashScreenManager.registerOnActivity')
    );
    for (const id of APP_ICON_IDS)
      expect(patched).toContain(`"${id}" to R.style.Theme_App_SplashScreen_${withThemeAppIcons.pascal(id)}`);
    expect(withThemeAppIcons.applyLaunchThemeToActivity(patched, iconPlugin[1])).toBe(patched);
    expect(() => withThemeAppIcons.applyLaunchThemeToActivity('changed template', iconPlugin[1])).toThrow(
      'onCreate'
    );
  });
});
