/**
 * The top of Activity after the cleanup: the Spent card (a change pill,
 * Week/Month in its corner, a one-line legend or what the tapped bar cost,
 * Money in | Net as a strip) and the type filter as one segmented bar, with
 * picked categories under it only while there are some. All figures are
 * made up.
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
        expenseChangePct={-16}
        viewScope="week"
        onChangeViewScope={jest.fn()}
        bars={[]}
        legend={legend}
        onPressDay={jest.fn()}
        selectedKey={null}
        hint={null}
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
    expect(all.some((t) => t.includes('16% vs last week'))).toBe(true);
  });

  it('names the four biggest categories, then how many more', () => {
    const all = texts(headline());
    expect(all).toEqual(expect.arrayContaining(['Food', 'Shopping', '+2 more']));
    expect(all).not.toContain('Travel');
  });

  it('shows what a tapped bar cost in the legend’s place, and no instruction before that', () => {
    expect(texts(headline()).some((t) => t.startsWith('Tap a bar'))).toBe(false);
    const all = texts(headline({ hint: { title: 'Monday, 22 Sept', detail: '₹2,480 spent' } }));
    expect(all).toContain('Monday, 22 Sept');
    expect(all).not.toContain('+2 more');
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
