/**
 * A list row's title and its amount are written in the shared row weight (`theme.font.bodyMedium`, as Home,
 * Activity and Plan write theirs). Goals and Loans wrote the name in the rounded display face, and Budgets,
 * Goals and Recurring wrote titles and amounts a weight heavier, so these four screens read as a different app.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const ROW_STYLES: [file: string, styles: string[]][] = [
  ['src/features/goals/GoalCard.tsx', ['name', 'saved']],
  ['src/features/budgets/budgets.styles.ts', ['rowName', 'rowHead']],
  ['src/features/loans/LoanCard.tsx', ['name']],
  ['src/features/recurring/recurring.styles.ts', ['rowTitle', 'ruleAmount']],
];

/** The `fontFamily` token written in one named, single-level style object of a file. */
const fontOf = (source: string, style: string): string | undefined =>
  new RegExp(`\\b${style}: \\{([^{}]*)\\}`).exec(source)?.[1].match(/fontFamily: theme\.font\.(\w+)/)?.[1];

describe.each(ROW_STYLES)('%s', (file, styles) => {
  const source = readFileSync(join(ROOT, file), 'utf8');
  it.each(styles)('%s is in the shared row weight', (style) => {
    expect(fontOf(source, style)).toBe('bodyMedium');
  });
});
