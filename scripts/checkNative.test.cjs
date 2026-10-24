const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkManifest, checkModules } = require('./checkNative.cjs');

const alias = (name, enabled) =>
  `<activity-alias android:name="${name}" android:enabled="${enabled}" android:exported="true" android:targetActivity=".MainActivity" android:icon="@mipmap/${name}"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity-alias>`;

const GOOD = `<manifest xmlns:android="a" xmlns:tools="t">
  <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" tools:node="remove"/>
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" tools:node="remove"/>
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"/>
  <application android:allowBackup="false">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter><action android:name="android.intent.action.VIEW"/><data android:scheme="yume"/></intent-filter>
      <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts"/>
    </activity>
    ${alias('.IconYume', 'true')}
    ${alias('.IconCorpsGreen', 'false')}
  </application>
</manifest>`;

test('the expected manifest has no problems', () => {
  assert.deepEqual(checkManifest(GOOD), []);
});

test('a disabled MainActivity is caught', () => {
  const bad = GOOD.replace(
    '<activity android:name=".MainActivity"',
    '<activity android:name=".MainActivity" android:enabled="false"'
  );
  assert.match(checkManifest(bad).join('\n'), /MainActivity is disabled/);
});

test('a launcher on MainActivity, as well as the aliases, is caught', () => {
  const bad = GOOD.replace(
    '<data android:scheme="yume"/></intent-filter>',
    '<data android:scheme="yume"/></intent-filter><intent-filter><category android:name="android.intent.category.LAUNCHER"/></intent-filter>'
  );
  assert.match(checkManifest(bad).join('\n'), /must not be a launcher/);
});

test('more or fewer than one enabled icon alias is caught', () => {
  assert.match(
    checkManifest(GOOD.replace(alias('.IconCorpsGreen', 'false'), alias('.IconCorpsGreen', 'true'))).join(
      '\n'
    ),
    /Exactly one icon alias/
  );
  assert.match(
    checkManifest(GOOD.replace(alias('.IconYume', 'true'), alias('.IconYume', 'false'))).join('\n'),
    /Exactly one icon alias/
  );
});

test('the default alias must be the Yume icon', () => {
  const bad = GOOD.replace(alias('.IconYume', 'true'), alias('.IconOther', 'true'));
  assert.match(checkManifest(bad).join('\n'), /must be \.IconYume/);
});

test('an alias that points elsewhere or has no launcher filter is caught', () => {
  const bad = GOOD.replace(
    'android:targetActivity=".MainActivity" android:icon="@mipmap/.IconCorpsGreen"',
    'android:targetActivity=".Other" android:icon="@mipmap/.IconCorpsGreen"'
  );
  assert.match(checkManifest(bad).join('\n'), /must target \.MainActivity/);
  const noFilter = GOOD.replace(
    /(<activity-alias android:name="\.IconCorpsGreen"[^>]*>)<intent-filter>.*?<\/intent-filter>/,
    '$1'
  );
  assert.match(checkManifest(noFilter).join('\n'), /MAIN\/LAUNCHER/);
});

test('backups, storage permissions and biometrics are checked', () => {
  assert.match(
    checkManifest(GOOD.replace('allowBackup="false"', 'allowBackup="true"')).join('\n'),
    /allowBackup/
  );
  assert.match(
    checkManifest(
      GOOD.replace(/<uses-permission android:name="android.permission.USE_BIOMETRIC"\/>/, '')
    ).join('\n'),
    /USE_BIOMETRIC/
  );
  assert.match(checkManifest(GOOD.replace(/ tools:node="remove"/g, '')).join('\n'), /must be removed/);
});

test('missing shortcuts or link scheme are caught', () => {
  assert.match(checkManifest(GOOD.replace('android.app.shortcuts', 'other')).join('\n'), /shortcuts/);
  assert.match(
    checkManifest(GOOD.replace('android:scheme="yume"', 'android:scheme="x"')).join('\n'),
    /link scheme/
  );
});

test('the app icon module must be autolinked', () => {
  assert.deepEqual(checkModules(['expo', 'yume-app-icon']), []);
  assert.equal(checkModules(['expo']).length, 1);
});
