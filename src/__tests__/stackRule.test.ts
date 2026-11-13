/**
 * "Narrow phone or large text, so the columns become a column" is decided in one place, `useStacked`. A copy of
 * the rule in a component drifts: neighbouring cards then flip at different sizes, and one of the copies
 * stacks its children without the layout that goes with it. Rows that really need another cut-off keep their
 * own constant (HeroLegend, CashFlowCard, AmountCard, the Activity period row, Plan's status tiles).
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

const sources = [...files(join(ROOT, 'app')), ...files(join(ROOT, 'src'))].filter(
  (f) => !f.endsWith(join('lib', 'useStacked.ts'))
);

it('looks at the app and its components', () => {
  expect(sources.length).toBeGreaterThan(200);
});

it('keeps the shared rule in useStacked instead of repeating it', () => {
  const copies = sources.filter((f) =>
    /width\s*(<\s*360|>=\s*360)[^\n]*fontScale\s*(>|<=)\s*1\.2\b/.test(readFileSync(f, 'utf8'))
  );
  expect(copies.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
});
