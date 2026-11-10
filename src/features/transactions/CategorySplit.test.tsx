import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/CountUpAmount', () => ({
  CountUpAmount: ({ minor }: { minor: number }) => {
    const { Text: T } = require('react-native');
    const { formatMoney: money } = require('@/lib/money');
    return <T>{money(minor)}</T>;
  },
}));

import { CategorySplit } from './CategorySplit';
import { TransactionsHeadline } from './TransactionsHeadline';
import { UNCATEGORIZED_ID } from './spendChart';

const items = ['Bills', 'Dining out', 'Groceries', 'Shopping', 'Transport'].map((name, i) => ({
  categoryId: `c${i}`,
  name,
  color: '#FF9E7D',
  totalMinor: (5 - i) * 100_000,
}));

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
const chip = (r: ReactTestRenderer, start: string) =>
  r.root.find(
    (n) =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(start) &&
      typeof n.props.onPress === 'function'
  );

function render(node: React.ReactElement) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(node);
  });
  return r;
}

it('shows each category with its amount in one row and filters to the one tapped', () => {
  const onToggle = jest.fn();
  const r = render(<CategorySplit items={items} selectedIds={[]} onToggle={onToggle} />);
  expect(texts(r)).toEqual(expect.arrayContaining(['Bills', '₹5,000', 'Transport', '₹1,000']));
  const row = r.root.find((n) => n.props.accessibilityLabel === 'Filter by category');
  expect(row.props.horizontal).toBe(true);
  act(() => chip(r, 'Dining out').props.onPress());
  expect(onToggle).toHaveBeenCalledWith('c1');
  expect(chip(r, 'Dining out').props.accessibilityState).toEqual({ selected: false });
  act(() => r.unmount());
});

it('marks the picked category and offers to show everything again', () => {
  const r = render(<CategorySplit items={items} selectedIds={['c4']} onToggle={jest.fn()} />);
  expect(chip(r, 'Transport').props.accessibilityState).toEqual({ selected: true });
  expect(chip(r, 'Transport').props.accessibilityHint).toBe('Shows every category again');
  expect(chip(r, 'Bills').props.accessibilityState).toEqual({ selected: false });
  act(() => r.unmount());
});

it('shows a fade at the edge only while more chips lie beyond it', () => {
  const r = render(<CategorySplit items={items} selectedIds={[]} onToggle={jest.fn()} />);
  const row = r.root.find((n) => n.props.accessibilityLabel === 'Filter by category');
  const fades = () =>
    r.root.findAll((n) => n.props.pointerEvents === 'none' && Array.isArray(n.props.colors));
  expect(fades()).toHaveLength(0);
  act(() => {
    row.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
    row.props.onContentSizeChange(620, 40);
  });
  expect(fades().length).toBeGreaterThan(0);
  // Scrolled to the end: nothing more to hint at.
  act(() => row.props.onScroll({ nativeEvent: { contentOffset: { x: 330 } } }));
  expect(fades()).toHaveLength(0);
  act(() => r.unmount());
});

it('does not offer uncategorized spending as a filter', () => {
  const r = render(
    <CategorySplit
      items={[{ categoryId: UNCATEGORIZED_ID, name: 'Uncategorized', color: '#999999', totalMinor: 5000 }]}
      selectedIds={[]}
      onToggle={jest.fn()}
    />
  );
  expect(r.root.findAll((n) => n.props.accessibilityRole === 'button')).toHaveLength(0);
  expect(texts(r)).toContain('Uncategorized');
  act(() => r.unmount());
});

it('narrows the headline to the picked category and drops whole-period figures', () => {
  const bar = (key: string, totalMinor: number) => ({
    key,
    label: 'M',
    totalMinor,
    segments: [{ categoryId: 'c1', name: 'Dining out', color: '#FF9E7D', amountMinor: totalMinor }],
    isCurrent: false,
  });
  const r = render(
    <TransactionsHeadline
      periodKey="week-2026-11-09"
      direction={0}
      expenseMinor={961_100}
      incomeMinor={1_200_000}
      expenseChangeMinor={-126_000}
      viewScope="week"
      bars={[bar('2026-11-09', 42_000), bar('2026-11-10', 30_000)]}
      legend={items}
      onPressDay={jest.fn()}
      selectedKey={null}
      current
      narrowedTo="Dining out"
      selectedCategoryIds={['c1']}
      onToggleCategory={jest.fn()}
    />
  );
  const shown = texts(r);
  expect(shown).toContain('Spent on Dining out this week');
  expect(shown.some((t) => t.includes('₹720'))).toBe(true);
  expect(shown).not.toContain('Money in');
  expect(shown.some((t) => t.includes('than last week'))).toBe(false);
  act(() => r.unmount());
});
