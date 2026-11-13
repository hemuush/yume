/**
 * No Reanimated CSS transition (`transitionProperty`, `transitionDuration`) is used in the app. They were tried for
 * Home's capsules, the month ring and Activity's underline and for a group panel that glided its own height; the
 * panel did not work on a phone and nothing here can run Android to find out why, so the mechanism was taken out
 * everywhere. A new use belongs behind a check on a device, and this test is then changed with it.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

const sources = [...files(join(ROOT, 'app')), ...files(join(ROOT, 'src'))];

it('looks at the app and its components', () => {
  expect(sources.length).toBeGreaterThan(200);
});

it('uses no CSS transition', () => {
  const users = sources
    .filter((f) => /\btransition(Property|Duration|TimingFunction|Delay)\b/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(ROOT.length + 1));
  expect(users).toEqual([]);
});
