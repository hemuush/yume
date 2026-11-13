/**
 * The cards (SummaryCard, ListCard, screenStyles.card) sit on the screen gutter themselves, so a screen that uses
 * them must not pad its scroll content as well: Recurring did, and its cards sat at twice the gutter (32 dp) under
 * headings at 16.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', 'app');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path)
      : /\.tsx$/.test(name) && !/\.test\./.test(name)
        ? [path]
        : [];
  });

/** The text of every `contentContainerStyle={{ ... }}` object literal in a source file. */
const contentStyles = (source: string): string[] => {
  const out: string[] = [];
  let at = source.indexOf('contentContainerStyle={{');
  while (at !== -1) {
    let depth = 0;
    let i = at + 'contentContainerStyle='.length;
    const start = i;
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}' && --depth === 0) break;
    }
    out.push(source.slice(start, i + 1));
    at = source.indexOf('contentContainerStyle={{', i);
  }
  return out;
};

describe('a screen built from the shared cards does not pad its scroll content sideways', () => {
  const screens = files(APP).filter((f) => /ListCard|SummaryCard|screenStyles/.test(readFileSync(f, 'utf8')));

  it('looks at the screens that use them', () => {
    expect(screens.length).toBeGreaterThan(5);
  });

  it.each(screens.map((f) => [f.slice(APP.length + 1), f]))('%s', (_name, file) => {
    const padded = contentStyles(readFileSync(file, 'utf8')).filter((s) =>
      /padding(Horizontal|Left|Right)\s*:/.test(s)
    );
    expect(padded).toEqual([]);
  });
});
