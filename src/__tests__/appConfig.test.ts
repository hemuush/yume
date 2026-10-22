/**
 * app.config.js layers build-dependent settings on app.json, and app.json carries the R8 keep rules a release APK
 * needs to open.
 */
const appJson = require('../../app.json').expo;
const buildConfig = require('../../app.config.js') as (input: { config: typeof appJson }) => typeof appJson;

const saved = process.env.EAS_BUILD_PROFILE;
afterEach(() => {
  if (saved === undefined) delete process.env.EAS_BUILD_PROFILE;
  else process.env.EAS_BUILD_PROFILE = saved;
});

it('leaves local builds untouched, because Metro needs the network', () => {
  delete process.env.EAS_BUILD_PROFILE;
  expect(buildConfig({ config: appJson })).toBe(appJson);
});

it('blocks INTERNET on EAS builds and keeps the other blocked permissions', () => {
  process.env.EAS_BUILD_PROFILE = 'preview';
  const blocked = buildConfig({ config: appJson }).android.blockedPermissions;
  expect(blocked).toContain('android.permission.INTERNET');
  appJson.android.blockedPermissions.forEach((permission: string) => expect(blocked).toContain(permission));
});

describe('R8 keep rules for WorkManager', () => {
  // react-native-android-widget pulls in WorkManager 2.8.1 (Room 2.5.0). Under SDK 58's full-mode R8 the generated
  // WorkDatabase_Impl loses its constructor and the release app closes at launch, before React Native starts.
  it('keeps the constructors WorkManager creates by reflection', () => {
    const props = appJson.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === 'expo-build-properties'
    )[1];
    const rules: string = props.android.extraProguardRules;
    expect(rules).toContain('-keep class * extends androidx.room.RoomDatabase { <init>(); }');
    expect(rules).toContain('-keep class * extends androidx.work.InputMerger { <init>(); }');
  });
});
