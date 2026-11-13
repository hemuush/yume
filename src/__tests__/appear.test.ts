/**
 * An error banner is an `Appear`, so it fades in and out instead of popping (and the blocks around it do not
 * jump). A plain `<View style={…errorBanner}>` would bring the pop back.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return /__tests__|test-support|node_modules/.test(path) ? [] : files(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

it('has no error banner drawn as a plain View', () => {
  const offenders = [...files(join(ROOT, 'app')), ...files(join(ROOT, 'src'))].filter((f) =>
    /<View style=\{\w+\.errorBanner\}>/.test(readFileSync(f, 'utf8'))
  );
  expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
});

it('still has error banners to check', () => {
  const using = [...files(join(ROOT, 'app')), ...files(join(ROOT, 'src'))].filter((f) =>
    /<Appear style=\{\w+\.errorBanner\}>/.test(readFileSync(f, 'utf8'))
  );
  expect(using.length).toBeGreaterThan(15);
});
