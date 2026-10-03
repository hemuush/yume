/**
 * Top of Activity: the Spent card (change pill, Week/Month corner, one-line legend, Money in | Net strip)
 * and the type filter as one segmented bar, picked categories under it only while any. Figures are made up.
 */
import { Text } from 'react-native';
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
        onChangeViewScope={jest.fn()}
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
  it('says the change as a pill, and In and Net as a strip', () => {
    const all = texts(headline());
    expect(all).toEqual(expect.arrayContaining(['Spent', 'Money in', '+₹5,796', 'Net', '−₹11,273']));
    expect(all.some((t) => t.includes('₹2,310 less than last week'))).toBe(true);
  });

  it('leaves the strip out when no money came in, since Net would only repeat Spent', () => {
    const all = texts(headline({ incomeMinor: 0 }));
    expect(all).not.toContain('Money in');
    expect(all).not.toContain('Net');
  });

  it('says how much more, in rupees, and what it is compared with', () => {
    const all = texts(headline({ expenseChangeMinor: 917_400, compareLabel: 'same days last week' }));
    expect(all.some((t) => t.includes('▲') && t.includes('₹9,174 more than same days last week'))).toBe(true);
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

  it('switches between Week and Month from its corner', () => {
    const onChange = jest.fn();
    const r = headline({ onChangeViewScope: onChange });
    const month = r.root.find(
      (n) =>
        n.props.accessibilityRole === 'radio' &&
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => t.props.children === 'Month')
    );
    act(() => month.props.onPress());
    expect(onChange).toHaveBeenCalledWith('month');
  });
});

describe('Activity filter bar', () => {
  function bar(categoryIds: string[]) {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <ActivityFilterChips
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

  it('adds a removable chip for a picked category', () => {
    expect(texts(bar(['groc']))).toContain('Groceries');
  });
});
