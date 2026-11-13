/**
 * Copy uses the typographic apostrophe (don’t, Suu’s), never the straight one (don't, Suu's), so every screen,
 * dialog and message reads the same. Comments, the PDF report (its own embedded font) and the home-screen
 * widgets are left out.
 */
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const files = [...sourceFiles(path.join(root, 'app')), ...sourceFiles(path.join(root, 'src'))].filter(
  (f) =>
    !f.endsWith('typography.test.ts') &&
    !f.includes(`${path.sep}widgets${path.sep}`) &&
    !f.endsWith(path.join('report', 'pdfHtml.ts'))
);
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');
const straight = /(?<=[A-Za-z}])'(?=(?:s|t|re|ll|ve|d|m)\b)/;

describe('typography', () => {
  it('uses the typographic apostrophe in copy, not the straight one', () => {
    const offenders = files.flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((line, i) => {
          const t = line.trimStart();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('--')) return [];
          return straight.test(line) ? [`${rel(f)}:${i + 1} ${t.slice(0, 70)}`] : [];
        })
    );
    expect(offenders).toEqual([]);
  });
});
