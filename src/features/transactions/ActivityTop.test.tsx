/**
 * Top of Activity: the Spent card (the figure, its change on one line, Money in / Left) and the type
 * filter as one row of chips, picked categories under it only while any. Figures are made up.
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
import { SpendBarChart } from './SpendBarChart';

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
        onPressDay={jest.fn()}
        selectedKey={null}
        {...over}
      />
    );
  });
  return r;
}

describe('Spent card', () => {
  it('shows the comparison under the figure and cashflow as its own line', () => {
    const all = texts(headline());
    expect(all).toEqual(expect.arrayContaining(['Spent', 'Money in', '₹5,796', 'Left', '−₹11,273']));
    expect(all.some((t) => t === '₹2,310 less')).toBe(true);
    expect(all.some((t) => t.endsWith('than last week'))).toBe(true);
  });

  it('leaves money in and net out when nothing came in, since Net would only repeat Spent', () => {
    const all = texts(headline({ incomeMinor: 0 }));
    expect(all.some((t) => t.endsWith(' in'))).toBe(false);
    expect(all.some((t) => t.startsWith('Left'))).toBe(false);
  });

  it('says how much more, in rupees, and what it is compared with', () => {
    const tree = headline({ expenseChangeMinor: 917_400, compareLabel: 'same days last week' });
    const all = texts(tree);
    expect(all.some((t) => t === '₹9,174 more')).toBe(true);
    expect(all.some((t) => t.endsWith('than same days last week'))).toBe(true);
    // An up arrow beside it: more spent.
    expect(tree.root.findAll((n) => n.props.name === 'arrow-up-right').length).toBeGreaterThan(0);
    expect(all.some((t) => t.includes('%'))).toBe(false);
  });

  it('shows no comparison when there is nothing to compare, or no change', () => {
    expect(texts(headline({ expenseChangeMinor: null })).some((t) => /more than|less than/.test(t))).toBe(
      false
    );
    expect(texts(headline({ expenseChangeMinor: 0 })).some((t) => /more than|less than/.test(t))).toBe(false);
  });
});

describe('Spent card chart', () => {
  const bar = (key: string, totalMinor: number, state?: 'future' | 'outside') => ({
    key,
    label: 'T',
    totalMinor,
    segments: [],
    isCurrent: false,
    ...(state ? { state } : {}),
  });

  it('hands the chart what a day cost so far: the days that have happened, empty ones included', () => {
    const tree = headline({
      bars: [
        bar('2026-10-01', 100_000),
        bar('2026-10-02', 0),
        bar('2026-10-03', 50_000),
        bar('2026-10-04', 0, 'future'),
      ],
    });
    expect(tree.root.findByType(SpendBarChart).props.averageMinor).toBe(50_000);
    act(() => tree.unmount());
  });

  it('draws no average with a single day, or while the figure is narrowed to a category', () => {
    const one = headline({ bars: [bar('2026-10-01', 100_000)] });
    expect(one.root.findByType(SpendBarChart).props.averageMinor).toBeNull();
    act(() => one.unmount());
    const narrowed = headline({
      narrowedTo: 'Food',
      bars: [bar('2026-10-01', 100_000), bar('2026-10-02', 0)],
    });
    expect(narrowed.root.findByType(SpendBarChart).props.averageMinor).toBeNull();
    act(() => narrowed.unmount());
  });
});

describe('Activity filter bar', () => {
  function bar(categoryIds: string[], onOpenFilters?: () => void, filterCount = 0, onFilterType = jest.fn()) {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <ActivityFilterChips
          onOpenFilters={onOpenFilters}
          filterCount={filterCount}
          filterType="all"
          onFilterType={onFilterType}
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

  it.each([1, 2])('keeps every type filter actionable at 320dp and text scale %s', (fontScale) => {
    const dimensions = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 320, height: 800, fontScale, scale: 1 });
    const choose = jest.fn();
    const tree = bar([], undefined, 0, choose);
    try {
      for (const label of ['all', 'spent', 'income', 'transfers']) {
        const button = tree.root.find(
          (n) => n.props.accessibilityLabel === `Show ${label}` && n.props.onPress
        );
        act(() => button.props.onPress());
      }
      expect(choose.mock.calls.map(([value]) => value)).toEqual(['all', 'expense', 'income', 'transfer']);
    } finally {
      act(() => tree.unmount());
      dimensions.mockRestore();
    }
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

it.each([
  { width: 390, fontScale: 1 },
  { width: 320, fontScale: 1 },
  { width: 390, fontScale: 1.5 },
])(
  'keeps the figure and its comparison together and cashflow as one wrapping line at $width / $fontScale',
  (size) => {
    const dimensions = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ ...size, height: 800, scale: 3 });
    try {
      const tree = headline();
      const lead = tree.root.find((n) => n.props.style === styles.sumLead);
      const labels = lead.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
      expect(labels.some((t) => t === '₹2,310 less')).toBe(true);
      expect(labels).not.toContain('Money in');
      const cashflow = tree.root.find((n) => n.props.style === styles.sumCashflow);
      const cash = cashflow.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
      expect(cash).toContain('Money in');
      expect(cash).toContain('Left');
      expect(StyleSheet.flatten(cashflow.props.style).flexWrap).toBe('wrap');
      act(() => tree.unmount());
    } finally {
      dimensions.mockRestore();
    }
  }
);
