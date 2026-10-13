const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hardenManifest, providerSource } = require('../plugins/withWidgetPrivacy');
const config = require('../app.json').expo;

test('release blocks unused photo access and keeps the native privacy plugin registered', () => {
  assert.ok(config.android.blockedPermissions.includes('android.permission.READ_MEDIA_IMAGES'));
  assert.ok(config.plugins.includes('./plugins/withWidgetPrivacy'));
});

test('widget authority uses the guarded provider, removing unrestricted library access', () => {
  const manifest = { $: {}, application: [{ provider: [{ $: { 'android:name': 'OtherProvider' } }] }] };
  hardenManifest(manifest, 'com.yume.app');
  const providers = manifest.application[0].provider;
  assert.equal(
    providers.find((p) => p.$['android:name'].endsWith('.RNWidgetImageProvider')).$['tools:node'],
    'remove'
  );
  assert.equal(
    providers.find((p) => p.$['android:name'].endsWith('.PrivateWidgetImageProvider')).$[
      'android:authorities'
    ],
    'com.yume.app.rnwidget.imageprovider'
  );
  assert.ok(providers.some((p) => p.$['android:name'] === 'OtherProvider'));
});

test('repeated prebuilds retain existing queries without duplicating providers or home visibility', () => {
  const existingIntent = { action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }] };
  const manifest = { $: {}, application: [{}], queries: [{ intent: [existingIntent] }] };
  hardenManifest(manifest, 'com.yume.app');
  const once = JSON.stringify(manifest);
  hardenManifest(manifest, 'com.yume.app');
  assert.equal(JSON.stringify(manifest), once);
  assert.equal(manifest.queries[0].intent[0], existingIntent);
});

test('generated Java retains literal regex escapes and checks caller before opening the image', () => {
  const source = providerSource('com.yume.app');
  assert.ok(source.includes('replaceAll("\\\\?.*", "")'));
  assert.ok(source.includes('\\\\.png'));
  assert.ok(source.indexOf('applicationInfo.uid != caller') < source.indexOf('super.openFile(uri, mode)'));
  assert.ok(source.includes('Process.SYSTEM_UID'));
});
