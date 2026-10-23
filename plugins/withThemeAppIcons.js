/**
 * One launcher icon per theme pack, switched at runtime by modules/yume-app-icon.
 *
 * Every icon, Yume's included, is an `Icon<Id>` activity-alias of MainActivity; only one is enabled. The
 * LAUNCHER category moves off MainActivity onto the aliases, so MainActivity stays enabled and keeps handling
 * shortcuts, widgets, notifications and yume:// links no matter which icon shows. Each alias repeats the
 * `android.app.shortcuts` meta-data, since static shortcuts attach to the launcher component.
 *
 * Props: { defaultId, icons: [{ id, background, icon, foreground }] }. The default icon reuses the app's own
 * ic_launcher resources; the others get an adaptive icon built from `foreground` (and a legacy one from `icon`).
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAndroidColors,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const ADAPTIVE_DP = 108;
const LEGACY_DP = 48;

const pascal = (id) => id.charAt(0).toUpperCase() + id.slice(1);
const snake = (id) => id.replace(/([A-Z])/g, '_$1').toLowerCase();
const colorName = (id) => `iconBackground${pascal(id)}`;

function aliasEntry(id, isDefault) {
  return {
    $: {
      'android:name': `.Icon${pascal(id)}`,
      'android:enabled': isDefault ? 'true' : 'false',
      'android:exported': 'true',
      'android:targetActivity': '.MainActivity',
      'android:icon': isDefault ? '@mipmap/ic_launcher' : `@mipmap/ic_launcher_${snake(id)}`,
      ...(isDefault ? { 'android:roundIcon': '@mipmap/ic_launcher_round' } : {}),
      'android:label': '@string/app_name',
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
    'meta-data': [{ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } }],
  };
}

/** Takes the LAUNCHER entry off MainActivity (dropping a filter left with only MAIN) and adds the aliases. */
function applyAliases(manifest, props) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const main = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  main['intent-filter'] = (main['intent-filter'] ?? []).filter((filter) => {
    const categories = filter.category ?? [];
    const launcher = categories.some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER');
    return !launcher;
  });
  const ours = new Set(props.icons.map((i) => `.Icon${pascal(i.id)}`));
  const kept = (app['activity-alias'] ?? []).filter((a) => !ours.has(a.$['android:name']));
  app['activity-alias'] = [...kept, ...props.icons.map((i) => aliasEntry(i.id, i.id === props.defaultId))];
  return manifest;
}

function adaptiveXml(id) {
  return `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/${colorName(id)}"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground_${snake(id)}"/>
</adaptive-icon>
`;
}

async function resize(projectRoot, cacheType, src, px, backgroundColor) {
  const { generateImageAsync } = require('@expo/image-utils');
  const { source } = await generateImageAsync(
    { projectRoot, cacheType },
    { src, width: px, height: px, resizeMode: 'cover', backgroundColor }
  );
  return source;
}

async function writeIcons(projectRoot, platformRoot, props) {
  const res = path.join(platformRoot, 'app', 'src', 'main', 'res');
  for (const icon of props.icons) {
    if (icon.id === props.defaultId) continue;
    const name = snake(icon.id);
    for (const [density, scale] of Object.entries(DENSITIES)) {
      const dir = path.join(res, `mipmap-${density}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `ic_launcher_${name}.png`),
        await resize(projectRoot, `theme-icon-${name}`, icon.icon, LEGACY_DP * scale, 'transparent')
      );
      fs.writeFileSync(
        path.join(dir, `ic_launcher_foreground_${name}.png`),
        await resize(
          projectRoot,
          `theme-icon-fg-${name}`,
          icon.foreground,
          ADAPTIVE_DP * scale,
          'transparent'
        )
      );
    }
    const anydpi = path.join(res, 'mipmap-anydpi-v26');
    fs.mkdirSync(anydpi, { recursive: true });
    fs.writeFileSync(path.join(anydpi, `ic_launcher_${name}.xml`), adaptiveXml(icon.id));
  }
}

function validate(props) {
  const icons = props?.icons;
  if (!Array.isArray(icons) || !icons.length)
    throw new Error('withThemeAppIcons: pass { defaultId, icons }.');
  if (!icons.some((i) => i.id === props.defaultId))
    throw new Error('withThemeAppIcons: defaultId is not in icons.');
  for (const i of icons) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(i.id)) throw new Error(`withThemeAppIcons: bad icon id "${i.id}".`);
    if (i.id !== props.defaultId && !(i.icon && i.foreground && /^#[0-9a-f]{6}$/i.test(i.background ?? ''))) {
      throw new Error(`withThemeAppIcons: icon "${i.id}" needs icon, foreground and a #rrggbb background.`);
    }
  }
}

module.exports = function withThemeAppIcons(config, props) {
  validate(props);
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = applyAliases(cfg.modResults, props);
    return cfg;
  });
  config = withAndroidColors(config, (cfg) => {
    for (const icon of props.icons) {
      if (icon.id === props.defaultId) continue;
      cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
        name: colorName(icon.id),
        value: icon.background,
      });
    }
    return cfg;
  });
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      await writeIcons(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot, props);
      return cfg;
    },
  ]);
};
module.exports.applyAliases = applyAliases;
module.exports.adaptiveXml = adaptiveXml;
module.exports.pascal = pascal;
