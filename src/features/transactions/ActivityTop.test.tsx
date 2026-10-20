/**
 * Top of Activity: the Spent card (change pill, Week/Month corner, one-line legend, Money in / Net corner)
 * and the type filter as one segmented bar, picked categories under it only while any. Figures are made up.
 */
import { Text, StyleSheet } from 'react-native';
import { styles } from './transactions.styles';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
jest.mock('./SpendBarChart', () => ({
  ...jest.requireActual('./SpendBarChart'),
  SpendBarChart: () => null,
}));
jest.useFakeTimers();

import { TransactionsHeadline } from './TransactionsHeadline';
import { ActivityFilterChips } from './ActivityFilterChips';

const legend = ['Food', 'Groceries', 'Fun', 'Shopping', 'Travel', 'Home'].map((name, i) => ({
  categoryId: `c${i}`,
  name,
  color: '#FF9E7D',
}));

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

function headline(over: Partial<React.ComponentProps<typeof TransactionsHeadline>> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <TransactionsHeadline
        periodKey="week-1"
        direction={0}
        expenseMinor={1_706_900}
        incomeMinor={579_600}
        expenseChangeMinor={-231_000}
        viewScope="week"
        bars={[]}
        legend={legend}
        onPressDay={jest.fn()}
        selectedKey={null}
        {...over}
      />
    );
  });
  return r;
}

describe('Spent card', () => {
  it('shows cashflow above the chart and keeps the comparison separate', () => {
    const all = texts(headline());
    expect(all).toEqual(expect.arrayContaining(['Spent', 'Money in', '₹5,796', 'Left', '−₹11,273']));
    expect(all.some((t) => t.includes('₹2,310 less than last week'))).toBe(true);
  });

  it('leaves money in and net out when nothing came in, since Net would only repeat Spent', () => {
    const all = texts(headline({ incomeMinor: 0 }));
    expect(all.some((t) => t.endsWith(' in'))).toBe(false);
    expect(all.some((t) => t.startsWith('Left'))).toBe(false);
  });

  it('says how much more, in rupees, and what it is compared with', () => {
    const tree = headline({ expenseChangeMinor: 917_400, compareLabel: 'same days last week' });
    const all = texts(tree);
    expect(all).toContain('₹9,174 more than same days last week');
    // An up arrow beside it: more spent.
    expect(tree.root.findAll((n) => n.props.name === 'arrow-up-right').length).toBeGreaterThan(0);
    expect(all.some((t) => t.includes('%'))).toBe(false);
  });

  it('has no pill when there is nothing to compare, or no change', () => {
    expect(texts(headline({ expenseChangeMinor: null })).some((t) => /more than|less than/.test(t))).toBe(
      false
    );
    expect(texts(headline({ expenseChangeMinor: 0 })).some((t) => /more than|less than/.test(t))).toBe(false);
  });

  it('names the four biggest categories, then how many more', () => {
    const all = texts(headline());
    expect(all).toEqual(expect.arrayContaining(['Food', 'Shopping', '+2 more']));
    expect(all).not.toContain('Travel');
  });

  it('keeps the legend when a bar is tapped — the amount shows on the bar', () => {
    const all = texts(headline({ selectedKey: '2026-10-01' }));
    expect(all).toContain('+2 more');
  });
});

describe('Activity filter bar', () => {
  function bar(categoryIds: string[], onOpenFilters?: () => void, filterCount = 0) {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <ActivityFilterChips
          onOpenFilters={onOpenFilters}
          filterCount={filterCount}
          filterType="all"
          onFilterType={jest.fn()}
          categoryIds={categoryIds}
          accountIds={[]}
          categoryName={(id) => (id === 'groc' ? 'Groceries' : id)}
          accountName={(id) => id}
          onRemoveCategory={jest.fn()}
          onRemoveAccount={jest.fn()}
          onClearAll={jest.fn()}
        />
      );
    });
    return r;
  }

  it('is one bar of types, with no second line when nothing is picked', () => {
    const all = texts(bar([]));
    expect(all).toEqual(['All', 'Spent', 'Income', 'Transfers']);
  });

  it('opens Filters beside the type group and retains its active count', () => {
    const open = jest.fn();
    const tree = bar([], open, 2);
    const { HeaderIconButton } = require('@/components/AppHeader');
    const action = tree.root.findByType(HeaderIconButton);
    expect(action.props.label).toBe('Filters, 2 on');
    expect(action.props.count).toBe(2);
    act(() => action.props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('adds a removable chip for a picked category', () => {
    expect(texts(bar(['groc']))).toContain('Groceries');
  });
});

it('expands and collapses the category legend without changing the selected period', () => {
  const tree = headline();
  const toggle = () =>
    tree.root.findAll(
      (n) =>
        n.props.accessibilityLabel === 'Show all 6 categories' ||
        n.props.accessibilityLabel === 'Show fewer categories'
    )[0]!;
  expect(toggle().props.accessibilityState.expanded).toBe(false);
  act(() => toggle().props.onPress());
  expect(texts(tree)).toContain('Travel');
  expect(toggle().props.accessibilityState.expanded).toBe(true);
  act(() => toggle().props.onPress());
  expect(texts(tree)).not.toContain('Travel');
});

it.each([
  { width: 390, fontScale: 1, direction: 'row', align: 'flex-end' },
  { width: 320, fontScale: 1, direction: 'column', align: 'flex-start' },
  { width: 390, fontScale: 1.5, direction: 'column', align: 'flex-start' },
])('places cashflow in the top summary at $width / $fontScale', (size) => {
  const dimensions = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ ...size, height: 800, scale: 3 });
  try {
    const tree = headline();
    const top = tree.root.find((n) => Array.isArray(n.props.style) && n.props.style[0] === styles.sumTop);
    expect(StyleSheet.flatten(top.props.style).flexDirection).toBe(size.direction);
    const labels = top.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
    expect(labels).toContain('Money in');
    expect(labels).toContain('Left');
    const metric = top.findAll(
      (n) => Array.isArray(n.props.style) && n.props.style[0] === styles.sumMetric
    )[0];
    expect(StyleSheet.flatten(metric.props.style).alignItems).toBe(size.align);
    act(() => tree.unmount());
  } finally {
    dimensions.mockRestore();
  }
});
