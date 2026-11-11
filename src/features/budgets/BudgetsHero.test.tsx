/**
 * The top card of Budgets: what is left (or over) across all limits, the daily allowance and days left, the pace
 * bar, and what needs a look. Made-up figures.
 */
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';
import { BudgetsHero } from './BudgetsHero';
import type { BudgetsHeroFigures } from './budgetsOverview';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

const figures = (over: Partial<BudgetsHeroFigures> = {}): BudgetsHeroFigures => ({
  limitMinor: 3_900_000,
  spentMinor: 2_418_000,
  leftMinor: 1_482_000,
  overMinor: 0,
  daysLeft: 13,
  perDayMinor: 69_000,
  usedPct: 62,
  expectedPct: 42,
  budgetCount: 5,
  overCount: 0,
  aheadCount: 0,
  tone: 'ok',
  ...over,
});

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

function render(over: Partial<BudgetsHeroFigures> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<BudgetsHero figures={figures(over)} />);
  });
  return tree;
}

describe('BudgetsHero', () => {
  it('leads with what is left, the daily allowance and the days left', () => {
    const shown = texts(render());
    expect(shown).toContain('Left this month');
    expect(shown).toContain('₹690 a day');
    expect(shown).toContain('13 days left');
    expect(shown).toEqual(expect.arrayContaining(['Spent', 'Limit']));
  });

  it('shows the pace under the bar, and reads the bar out in words', () => {
    const tree = render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['62% used', 'Even pace 42%']));
    const bar = tree.root.find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('even month')
    );
    expect(bar.props.accessibilityLabel).toContain('₹24,180 spent of ₹39,000');
  });

  it('says on track when nothing is over or ahead', () => {
    const shown = texts(render());
    expect(shown).toContain('On track');
    expect(shown).not.toContain('Needs a look');
  });

  it('names what is over and what is ahead of pace in one fact, red once anything is over', () => {
    const tree = render({ overCount: 1, aheadCount: 1, tone: 'over' });
    expect(texts(tree)).toEqual(expect.arrayContaining(['Needs a look', '1 over · 1 ahead']));
    const value = tree.root
      .findAllByType(Text)
      .find((t) => [t.props.children].flat().join('') === '1 over · 1 ahead')!;
    expect((StyleSheet.flatten(value.props.style) as { color?: string }).color).toBe(
      theme.colors.expenseText
    );
  });

  it('turns to what is over once spending passes the limits', () => {
    const shown = texts(
      render({
        spentMinor: 4_100_000,
        leftMinor: 0,
        overMinor: 200_000,
        perDayMinor: null,
        usedPct: 100,
        tone: 'over',
      })
    );
    expect(shown).toContain('Over this month');
    expect(shown).not.toContain('₹690 a day');
    expect(shown).toContain('13 days left');
  });

  it('says last day, and explains nested limits when there are some', () => {
    const shown = texts(render({ daysLeft: 0, perDayMinor: null, nestedCount: 2 }));
    expect(shown).toContain('Last day');
    expect(shown.some((t) => t.startsWith('Subcategory limits are included'))).toBe(true);
  });
});
