/**
 * A screen that shows placeholders while it loads must fade its content in when the data arrives (LoadFade, or
 * `entering={CONTENT_ENTER}` on its scroll view, or Home's own section entrances), instead of cutting from grey bars
 * to cards. Garden is left out: its own decorative flow has its own timings (docs/CALM_MOTION).
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', 'app');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

const EXEMPT = ['garden.tsx'];
const screens = files(APP).filter(
  (f) =>
    /Skeleton/.test(readFileSync(f, 'utf8')) && !EXEMPT.some((name) => f.endsWith(name)) && !/_layout/.test(f)
);

it('looks at the screens that show placeholders', () => {
  expect(screens.length).toBeGreaterThan(12);
});

it.each(screens.map((f) => [f.slice(APP.length + 1), f]))(
  '%s fades its content in after loading',
  (_name, file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/LoadFade|CONTENT_ENTER|homeSectionEntering|homeRowEntering/);
  }
);
