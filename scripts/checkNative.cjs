#!/usr/bin/env node
/**
 * Checks what `expo prebuild --platform android` produced: the Android manifest the config plugins write
 * (launcher icon aliases, shortcuts, permissions, backups) and that the local app-icon module is autolinked.
 * Nothing here needs the Android SDK, so CI can catch a broken plugin before a release build does.
 *
 * Run after `npx expo prebuild --platform android --no-install`. The checks are pure functions of the manifest
 * text so they are tested in checkNative.test.cjs.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MANIFEST = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

/** Every element named `tag`, as { attrs, body }; enough structure for the checks below. */
function elements(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b([^>]*?)(/>|>([\\s\\S]*?)</${tag}>)`, 'g');
  let m;
  while ((m = re.exec(xml))) {
    const attrs = {};
    for (const a of m[1].matchAll(/([\w:.]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    out.push({ attrs, body: m[3] ?? '' });
  }
  return out;
}

/** The problems with a manifest, as plain sentences; an empty list means it is as expected. */
function checkManifest(xml) {
  const problems = [];
  const app = elements(xml, 'application')[0];
  if (!app) return ['The manifest has no <application>.'];
  if (app.attrs['android:allowBackup'] !== 'false') problems.push('android:allowBackup must be "false".');

  const permissions = elements(xml, 'uses-permission');
  const has = (name) => permissions.some((p) => p.attrs['android:name'] === name && !p.attrs['tools:node']);
  const removed = (name) =>
    permissions.some((p) => p.attrs['android:name'] === name && p.attrs['tools:node'] === 'remove');
  if (!has('android.permission.USE_BIOMETRIC')) problems.push('USE_BIOMETRIC is missing (app lock).');
  for (const name of [
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.SYSTEM_ALERT_WINDOW',
  ]) {
    if (!removed(name)) problems.push(`${name} must be removed from the merged manifest.`);
  }

  const main = elements(xml, 'activity').find((a) => a.attrs['android:name'] === '.MainActivity');
  if (!main) problems.push('MainActivity is missing.');
  else {
    if (main.attrs['android:enabled'] === 'false')
      problems.push('MainActivity is disabled: shortcuts, widgets and links would stop working.');
    if (main.attrs['android:exported'] !== 'true') problems.push('MainActivity must be exported.');
    if (main.body.includes('android.intent.category.LAUNCHER'))
      problems.push('MainActivity must not be a launcher itself: the icon aliases are, or two icons appear.');
    if (!main.body.includes('android.app.shortcuts'))
      problems.push('The app shortcuts meta-data is missing.');
    if (!/android:scheme="yume"/.test(main.body)) problems.push('The yume:// link scheme is missing.');
  }

  const aliases = elements(xml, 'activity-alias');
  if (aliases.length === 0) problems.push('There are no launcher icon aliases.');
  const enabled = aliases.filter((a) => a.attrs['android:enabled'] !== 'false');
  if (enabled.length !== 1)
    problems.push(`Exactly one icon alias must start enabled, found ${enabled.length}.`);
  else if (enabled[0].attrs['android:name'] !== '.IconYume')
    problems.push('The icon alias enabled at install must be .IconYume.');
  for (const a of aliases) {
    const name = a.attrs['android:name'];
    if (a.attrs['android:targetActivity'] !== '.MainActivity')
      problems.push(`${name} must target .MainActivity.`);
    if (a.attrs['android:exported'] !== 'true') problems.push(`${name} must be exported.`);
    if (
      !a.body.includes('android.intent.action.MAIN') ||
      !a.body.includes('android.intent.category.LAUNCHER')
    )
      problems.push(`${name} needs a MAIN/LAUNCHER intent filter.`);
    if (!a.attrs['android:icon']) problems.push(`${name} has no icon.`);
  }
  const names = aliases.map((a) => a.attrs['android:name']);
  if (new Set(names).size !== names.length) problems.push('Two icon aliases share a name.');
  return problems;
}

/** The problems with the list of autolinked Android modules (package names). */
function checkModules(names) {
  return names.includes('yume-app-icon') ? [] : ['The yume-app-icon module is not autolinked.'];
}

/** JS-only icon tests cannot catch a missing launch hook or resource reference needed by release shrinking. */
function checkLaunchResources(styles, activity, icons, defaultId) {
  const problems = [];
  const iconAttributes = ['windowSplashScreenAnimatedIcon', 'android:windowSplashScreenAnimatedIcon'];
  const base = elements(styles, 'style').find((s) => s.attrs.name === 'Theme.App.SplashScreen');
  const baseItems = elements(base?.body ?? '', 'item');
  if (
    iconAttributes.some(
      (name) => !baseItems.some((item) => item.attrs.name === name && item.body.trim() === '@null')
    )
  )
    problems.push('The base launch theme must not flash a fixed original icon before onCreate.');
  const hook = activity.indexOf('YumeAppIconModule.applyLaunchTheme(');
  const install = activity.indexOf('SplashScreenManager.registerOnActivity(');
  if (hook < 0 || install < 0 || hook > install)
    problems.push('The icon launch theme must be applied before Expo installs the splash screen.');
  for (const icon of icons) {
    const pascal = icon.id.charAt(0).toUpperCase() + icon.id.slice(1);
    const name = `Theme.App.SplashScreen.${pascal}`;
    const style = elements(styles, 'style').find((s) => s.attrs.name === name);
    const drawable =
      icon.id === defaultId
        ? 'splashscreen_logo'
        : `splashscreen_${icon.id.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
    const items = elements(style?.body ?? '', 'item');
    if (
      !style ||
      style.attrs.parent !== 'Theme.App.SplashScreen' ||
      iconAttributes.some(
        (name) =>
          !items.some((item) => item.attrs.name === name && item.body.trim() === `@drawable/${drawable}`)
      )
    )
      problems.push(`${name} needs its matching launch drawable.`);
    if (!activity.includes(`"${icon.id}" to R.style.${name.replace(/\./g, '_')}`))
      problems.push(
        `MainActivity must reference ${icon.id}'s style directly so release shrinking retains it.`
      );
  }
  return problems;
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`No ${MANIFEST}: run "npx expo prebuild --platform android --no-install" first.`);
    process.exit(2);
  }
  const problems = checkManifest(fs.readFileSync(MANIFEST, 'utf8'));
  const config = require('../app.json').expo;
  const props = config.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === './plugins/withThemeAppIcons'
  )[1];
  const main = path.join('android', 'app', 'src', 'main');
  problems.push(
    ...checkLaunchResources(
      fs.readFileSync(path.join(main, 'res', 'values', 'styles.xml'), 'utf8'),
      fs.readFileSync(
        path.join(main, 'java', ...config.android.package.split('.'), 'MainActivity.kt'),
        'utf8'
      ),
      props.icons,
      props.defaultId
    )
  );
  for (const icon of props.icons.filter((icon) => icon.id !== props.defaultId)) {
    const name = icon.id.replace(/([A-Z])/g, '_$1').toLowerCase();
    for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
      const image = fs.readFileSync(
        path.join(main, 'res', `drawable-${density}`, `splashscreen_${name}.png`)
      );
      if (image.readUInt32BE(16) !== 288 * scale || image.readUInt32BE(20) !== 288 * scale)
        problems.push(`${name} has an invalid ${density} splash canvas.`);
    }
  }
  const resolved = JSON.parse(
    execFileSync(
      process.execPath,
      [
        require.resolve('expo-modules-autolinking/bin/expo-modules-autolinking.js'),
        'resolve',
        '--platform',
        'android',
        '--json',
      ],
      {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
      }
    )
  );
  const modules = (resolved.modules ?? resolved).map((m) => m.packageName ?? m.name);
  problems.push(...checkModules(modules));
  if (problems.length) {
    console.error(`Native configuration problems:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Native configuration looks right.');
}

if (require.main === module) main();
module.exports = { checkManifest, checkModules, checkLaunchResources, elements };
