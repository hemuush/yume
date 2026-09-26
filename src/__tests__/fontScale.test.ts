/**
 * Text follows the phone's font-size setting only up to MAX_FONT_SCALE
 * (130%) — past that, fixed-size tiles and cards cut text off. That limit
 * lives in src/components/Text.tsx, so every screen must take Text and
 * TextInput from there, and every animated text (which can't use the
 * wrapper) must pass the limit itself.
 */
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

const files = [...sourceFiles(path.join(root, 'app')), ...sourceFiles(path.join(root, 'src'))].filter(
  (f) =>
    // Home-screen widgets render through RemoteViews, not React Native's Text.
    !f.includes(`${path.sep}widgets${path.sep}`) &&
    !f.includes(`${path.sep}test-support${path.sep}`) &&
    !f.endsWith(path.join('components', 'Text.tsx'))
);
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');

describe('font scale limit', () => {
  it("no screen takes Text or TextInput straight from 'react-native'", () => {
    const offenders = files.filter((f) => {
      const m = /import \{([^}]*)\} from 'react-native'/.exec(fs.readFileSync(f, 'utf8'));
      return m != null && m[1].split(',').some((s) => ['Text', 'TextInput'].includes(s.trim()));
    });
    expect(offenders.map(rel)).toEqual([]);
  });

  it('every animated text passes the limit itself', () => {
    const offenders = files.flatMap((f) => {
      const src = fs.readFileSync(f, 'utf8');
      // The opening tag, up to its first `>` that isn't part of an arrow `=>`.
      return [...src.matchAll(/<(?:ReanimatedAnimated|Animated)\.Text\b[\s\S]*?(?<!=)>/g)]
        .filter((m) => !m[0].includes('maxFontSizeMultiplier'))
        .map((m) => `${rel(f)}:${src.slice(0, m.index).split('\n').length}`);
    });
    expect(offenders).toEqual([]);
  });
});
