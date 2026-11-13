/**
 * Activity's filter row: Clear all comes last, and picking a type never moves the types. The row is read as
 * the sequence of tappable things in it, in order, in both layouts (the scrolling row and the wrapped one).
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
jest.mock('@/components/AppHeader', () => {
  const { Pressable } = require('react-native');
  return {
    HeaderIconButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityLabel={label} onPress={onPress} />
    ),
  };
});

import { ActivityFilterChips } from './ActivityFilterChips';
import type { ActivityType } from './activityFilter';

const rowAt = (
  width: number,
  fontScale: number,
  over: Partial<Parameters<typeof ActivityFilterChips>[0]>
) => {
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width, height: 800, scale: 3, fontScale });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ActivityFilterChips
        filterType={'all' as ActivityType}
        onFilterType={jest.fn()}
        categoryIds={[]}
        accountIds={[]}
        categoryName={(id) => (id === 'food' ? 'Food' : id)}
        accountName={(id) => id}
        onRemoveCategory={jest.fn()}
        onRemoveAccount={jest.fn()}
        onRemoveLabel={jest.fn()}
        onClearAll={jest.fn()}
        onOpenFilters={jest.fn()}
        {...over}
      />
    );
  });
  const order = tree.root
    .findAll((n) => typeof n.props.onPress === 'function' && typeof n.props.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel as string);
  act(() => tree.unmount());
  return order;
};

const LAYOUTS: [string, number, number][] = [
  ['the scrolling row', 390, 1],
  ['the wrapped row at large text', 390, 1.5],
];

afterEach(() => jest.restoreAllMocks());

describe.each(LAYOUTS)('filter row, %s', (_name, width, fontScale) => {
  const row = (over: Partial<Parameters<typeof ActivityFilterChips>[0]> = {}) =>
    rowAt(width, fontScale, over);
  const TYPES = ['Show all', 'Show spent', 'Show income', 'Show transfers'];

  it('has no Clear all while nothing is picked', () => {
    expect(row()).toEqual(['Filters', ...TYPES]);
  });

  it('puts Clear all after the types, not in front of them, once a type is picked', () => {
    expect(row({ filterType: 'expense' })).toEqual(['Filters', ...TYPES, 'Clear all Activity filters']);
  });

  it('leaves every type exactly where it was when a type is picked', () => {
    const before = row();
    const after = row({ filterType: 'expense' });
    TYPES.forEach((label) => expect(after.indexOf(label)).toBe(before.indexOf(label)));
  });

  it('keeps the picked chips ahead of the types and Clear all last of all', () => {
    expect(
      row({ filterType: 'income', categoryIds: ['food'], accountIds: ['SBI'], expenseLabel: 'Lunch' })
    ).toEqual([
      'Filters',
      'Remove the Food filter',
      'Remove the SBI filter',
      'Remove expense label filter',
      ...TYPES,
      'Clear all Activity filters',
    ]);
  });

  it('offers Clear all for a lone category, label or account chip too, still last', () => {
    for (const over of [{ categoryIds: ['food'] }, { accountIds: ['SBI'] }, { expenseLabel: 'Lunch' }]) {
      const order = row(over);
      expect(order[order.length - 1]).toBe('Clear all Activity filters');
    }
  });
});
