/**
 * Every text style in the app sets one of Yume's fonts. In React Native a
 * text style without a `fontFamily` doesn't fall back to anything of ours —
 * it renders in the phone's default font (Roboto on most Android phones),
 * which is how 61 styles across 14 files ended up in the wrong typeface.
 * This fails as soon as a new style repeats that: a style object that sets a
 * fontSize or fontWeight must also set a fontFamily.
 *
 * Deliberately not covered: src/widgets (home-screen widgets render through
 * the widget library, with their own font setup).
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (!/node_modules|widgets|__tests__|test-support/.test(full)) sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('font consistency', () => {
  it('every style that sizes or weights text also sets a Yume font', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'src'))]) {
      const src = fs.readFileSync(file, 'utf8');
      // One-level style objects: "name: { ... }"
      const styleObject = /([A-Za-z0-9]+): \{([^{}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = styleObject.exec(src))) {
        if (/\bfont(Size|Weight)\b/.test(m[2]) && !/\bfontFamily\b/.test(m[2])) {
          offenders.push(`${path.relative(ROOT, file).split(path.sep).join('/')} → ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
