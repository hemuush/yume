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

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`No ${MANIFEST}: run "npx expo prebuild --platform android --no-install" first.`);
    process.exit(2);
  }
  const problems = checkManifest(fs.readFileSync(MANIFEST, 'utf8'));
  const resolved = JSON.parse(
    execFileSync('npx', ['expo-modules-autolinking', 'resolve', '--platform', 'android', '--json'], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    })
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
module.exports = { checkManifest, checkModules, elements };
