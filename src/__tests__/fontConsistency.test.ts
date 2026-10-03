/**
 * Every text style sets one of Yume's fonts: a React Native style without `fontFamily` renders in the phone's
 * default font, so one setting fontSize or fontWeight must also set fontFamily. Not covered: src/widgets.
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
