/**
 * A search box is not a sentence: it must not capitalise the first letter or autocorrect what you type. Every
 * TextInput labelled "Find …" or "Search …" turns both off.
 */
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

const files = [...sourceFiles(path.join(root, 'app')), ...sourceFiles(path.join(root, 'src'))];
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');

it('turns off capitals and autocorrect on every search box', () => {
  const offenders: string[] = [];
  let seen = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<TextInput\b([\s\S]*?)\/>/g)) {
      const tag = m[1];
      if (!/accessibilityLabel=["'{`]*\s*["'`]?(Find|Search)\b/.test(tag)) continue;
      seen += 1;
      if (!/autoCapitalize="none"/.test(tag) || !/autoCorrect=\{false\}/.test(tag)) offenders.push(rel(f));
    }
  }
  expect(seen).toBeGreaterThanOrEqual(4);
  expect(offenders).toEqual([]);
});
