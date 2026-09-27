/**
 * Android app shortcuts: long-press Yume's icon for Add expense, Add income
 * or Transfer. Each opens Add with its type already chosen, through the same
 * yume://add-transaction?type=… links the Quick Add widget uses — so there's
 * no new screen or route, only a faster way in. If the app lock is on, the
 * lock screen comes first and then lands on Add, the same as the widget.
 *
 * Static shortcuts need three things the app config can't express on its
 * own: a res/xml/shortcuts.xml, string resources for the labels, and a
 * meta-data entry on the main activity pointing at the XML. The icons are
 * small vector drawables in the app's palette.
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withStringsXml,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const SHORTCUTS = [
  { id: 'add_expense', label: 'Add expense', type: 'expense', tint: '#F0876A', glyph: 'M6,12h12' },
  { id: 'add_income', label: 'Add income', type: 'income', tint: '#3FBF8F', glyph: 'M6,12h12M12,6v12' },
  {
    id: 'transfer',
    label: 'Transfer',
    type: 'transfer',
    tint: '#3E8FD6',
    glyph: 'M7,9h10l-3,-3M17,15H7l3,3',
  },
];

function shortcutsXml(packageName, scheme) {
  const items = SHORTCUTS.map(
    (s) => `  <shortcut
    android:shortcutId="${s.id}"
    android:enabled="true"
    android:icon="@drawable/shortcut_${s.id}"
    android:shortcutShortLabel="@string/shortcut_${s.id}">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity"
      android:data="${scheme}://add-transaction?type=${s.type}" />
  </shortcut>`
  ).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${items}\n</shortcuts>\n`;
}

/** A 24dp round badge in the shortcut's colour with a white stroke glyph. */
function iconXml(tint, glyph) {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="48dp" android:height="48dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="${tint}" android:pathData="M12,12m-12,0a12,12 0,1 1,24 0a12,12 0,1 1,-24 0" />
  <path android:strokeColor="#FFFFFF" android:strokeWidth="2.2" android:strokeLineCap="round"
    android:strokeLineJoin="round" android:fillColor="#00000000" android:pathData="${glyph}" />
</vector>
`;
}

const withShortcutMetaData = (config) =>
  withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const metaData = (activity['meta-data'] = activity['meta-data'] ?? []);
    if (!metaData.some((m) => m.$['android:name'] === 'android.app.shortcuts')) {
      metaData.push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    }
    return cfg;
  });

const withShortcutLabels = (config) =>
  withStringsXml(config, (cfg) => {
    for (const s of SHORTCUTS) {
      cfg.modResults = AndroidConfig.Strings.setStringItem(
        [AndroidConfig.Resources.buildResourceItem({ name: `shortcut_${s.id}`, value: s.label })],
        cfg.modResults
      );
    }
    return cfg;
  });

const withShortcutFiles = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
      const scheme = Array.isArray(cfg.scheme) ? cfg.scheme[0] : cfg.scheme;
      fs.writeFileSync(path.join(res, 'xml', 'shortcuts.xml'), shortcutsXml(cfg.android.package, scheme));
      for (const s of SHORTCUTS) {
        fs.writeFileSync(path.join(res, 'drawable', `shortcut_${s.id}.xml`), iconXml(s.tint, s.glyph));
      }
      return cfg;
    },
  ]);

module.exports = function withAppShortcuts(config) {
  return withShortcutFiles(withShortcutLabels(withShortcutMetaData(config)));
};
module.exports.SHORTCUTS = SHORTCUTS;
module.exports.shortcutsXml = shortcutsXml;
