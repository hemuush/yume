/**
 * How faint a control gets comes from three shared values (theme.opacity): disabled, limit (an arrow or step
 * at the end of its range) and pressed. A style named for one of those states must use the token, not its
 * own number, or the same state looks different from screen to screen.
 */
import fs from 'fs';
import path from 'path';
import { theme } from '@/constants/theme';

const root = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

const files = [...sourceFiles(path.join(root, 'app')), ...sourceFiles(path.join(root, 'src'))].filter(
  (f) => !f.includes(`${path.sep}widgets${path.sep}`) && !f.includes(`${path.sep}test-support${path.sep}`)
);
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');

describe('opacity scale', () => {
  it('keeps the three values in order: limit < disabled < pressed', () => {
    expect(theme.opacity).toEqual({ disabled: 0.45, limit: 0.35, pressed: 0.6 });
  });

  it('a style named for disabled, off or pressed uses the token, not a number', () => {
    const named =
      /\b\w*(?:[Dd]isabled|[Oo]ff|[Pp]ressed|blocked|dimmed)\w*:\s*\{[^{}]*?\bopacity:\s*0?\.[0-9]+/g;
    const offenders = files.flatMap((f) =>
      [...fs.readFileSync(f, 'utf8').matchAll(named)].map((m) => `${rel(f)}: ${m[0].slice(0, 70)}`)
    );
    expect(offenders).toEqual([]);
  });
});
