/**
 * Reanimated's enter, exit and layout animations only work on Reanimated components. Putting `entering`,
 * `exiting` or `layout` on core React Native's `Animated.View` (the same name, imported from 'react-native')
 * crashed BudgetRow, GoalCard and GoalChip before, so no screen may do it.
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
  (f) => !f.includes(`${path.sep}test-support${path.sep}`)
);
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');

/** The names this file imports from core 'react-native' (`Animated` is the one that matters). */
function coreAnimatedNames(src: string): string[] {
  const m = /import \{([^}]*)\} from 'react-native'/.exec(src);
  return m
    ? m[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s === 'Animated')
    : [];
}

describe('Reanimated layout props', () => {
  it('are never put on a core Animated component', () => {
    const offenders = files.flatMap((f) => {
      const src = fs.readFileSync(f, 'utf8');
      const core = coreAnimatedNames(src);
      if (core.length === 0) return [];
      // The opening tag, up to its first `>` that isn't part of an arrow `=>`.
      return [...src.matchAll(/<Animated\.\w+\b[\s\S]*?(?<!=)>/g)]
        .filter((m) => /\b(entering|exiting|layout)=/.test(m[0]))
        .map((m) => `${rel(f)}:${src.slice(0, m.index).split('\n').length}`);
    });
    expect(offenders).toEqual([]);
  });

  it('the check itself recognises a core Animated import', () => {
    expect(coreAnimatedNames("import { View, Animated } from 'react-native';")).toEqual(['Animated']);
    expect(coreAnimatedNames("import Animated from 'react-native-reanimated';")).toEqual([]);
  });
});
