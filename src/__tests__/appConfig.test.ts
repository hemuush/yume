/**
 * app.config.js layers build-dependent settings on app.json. The diagnose-* EAS profiles rely on its switches to
 * change one release-build setting at a time, so the default build must stay untouched and each switch must change
 * only its own setting.
 */
const appJson = require('../../app.json').expo;
const buildConfig = require('../../app.config.js') as (input: { config: typeof appJson }) => typeof appJson;

const ENV_KEYS = ['EAS_BUILD_PROFILE', 'YUME_R8_PRESET', 'YUME_MINIFY'] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => ENV_KEYS.forEach((key) => ((saved[key] = process.env[key]), delete process.env[key])));
afterEach(() =>
  ENV_KEYS.forEach((key) =>
    saved[key] === undefined ? delete process.env[key] : (process.env[key] = saved[key])
  )
);

const buildProperties = (config: typeof appJson) =>
  config.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-build-properties')[1].android;

it('leaves app.json untouched for a local build', () => {
  expect(buildConfig({ config: appJson })).toEqual(appJson);
});

it('drops the INTERNET permission for EAS builds only', () => {
  process.env.EAS_BUILD_PROFILE = 'preview';
  expect(buildConfig({ config: appJson }).android.blockedPermissions).toContain(
    'android.permission.INTERNET'
  );
  expect(appJson.android.blockedPermissions).not.toContain('android.permission.INTERNET');
});

it('restores the SDK 57 R8 preset only when asked, and keeps minification on', () => {
  process.env.YUME_R8_PRESET = 'legacy';
  const config = buildConfig({ config: appJson });
  expect(config.plugins).toContain('./plugins/withLegacyR8Preset');
  expect(buildProperties(config).enableMinifyInReleaseBuilds).toBe(true);
});

it('turns R8 minification and resource shrinking off only when asked, without the preset plugin', () => {
  process.env.YUME_MINIFY = 'off';
  const config = buildConfig({ config: appJson });
  expect(buildProperties(config)).toEqual({
    enableProguardInReleaseBuilds: false,
    enableShrinkResourcesInReleaseBuilds: false,
    enableMinifyInReleaseBuilds: false,
  });
  expect(config.plugins).not.toContain('./plugins/withLegacyR8Preset');
  expect(buildProperties(appJson).enableMinifyInReleaseBuilds).toBe(true);
});

it('rewrites only the preset line of the generated app/build.gradle', () => {
  const { useLegacyPreset } = require('../../plugins/withLegacyR8Preset') as {
    useLegacyPreset: (buildGradle: string) => string;
  };
  const generated = [
    '    release {',
    '        minifyEnabled enableMinifyInReleaseBuilds',
    '        proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"',
    '    }',
  ].join('\n');
  expect(useLegacyPreset(generated)).toBe(
    generated.replace('proguard-android-optimize.txt', 'proguard-android.txt')
  );
  const already = 'proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"';
  expect(useLegacyPreset(already)).toBe(already);
});
