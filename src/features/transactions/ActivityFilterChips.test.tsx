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

  it('puts what is picked after the types, and Clear all last of all', () => {
    expect(
      row({ filterType: 'income', categoryIds: ['food'], accountIds: ['SBI'], expenseLabel: 'Lunch' })
    ).toEqual([
      'Filters',
      ...TYPES,
      'Remove the Food filter',
      'Remove the SBI filter',
      'Remove expense label filter',
      'Clear all Activity filters',
    ]);
  });

  it('keeps the types where they are however many categories are picked, so a long list of chips never pushes them away', () => {
    const none = row();
    const many = row({
      categoryIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      accountIds: ['SBI'],
      expenseLabel: 'Lunch',
    });
    TYPES.forEach((label) => expect(many.indexOf(label)).toBe(none.indexOf(label)));
    // Everything picked comes after the last type.
    const lastType = many.indexOf('Show transfers');
    expect(many.slice(lastType + 1)).toHaveLength(9 + 1);
    expect(many.slice(lastType + 1).every((l) => /^(Remove|Clear)/.test(l))).toBe(true);
  });

  it('offers Clear all for a lone category, label or account chip too, still last', () => {
    for (const over of [{ categoryIds: ['food'] }, { accountIds: ['SBI'] }, { expenseLabel: 'Lunch' }]) {
      const order = row(over);
      expect(order[order.length - 1]).toBe('Clear all Activity filters');
    }
  });
});

describe('the filter row does not change size when it is used', () => {
  const mount = (over: Partial<Parameters<typeof ActivityFilterChips>[0]>) => {
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 390, height: 800, scale: 3, fontScale: 1 });
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <ActivityFilterChips
          filterType={'all' as ActivityType}
          onFilterType={jest.fn()}
          categoryIds={[]}
          accountIds={[]}
          categoryName={(id) => id}
          accountName={(id) => id}
          onRemoveCategory={jest.fn()}
          onRemoveAccount={jest.fn()}
          onClearAll={jest.fn()}
          onOpenFilters={jest.fn()}
          {...over}
        />
      );
    });
    return tree;
  };

  it('is as tall as its tallest chip from the start, so "Clear all" arriving does not move the pills or the list', () => {
    const { StyleSheet, ScrollView } = require('react-native');
    const tree = mount({});
    const row = StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle);
    // Clear all and a picked chip are 44 tall; the pills are 40.
    expect(row.minHeight).toBeGreaterThanOrEqual(44);
    act(() => tree.unmount());
  });

  it('writes a picked pill and an unpicked one in the same weight, so picking one moves none of the others', () => {
    const { StyleSheet, Text } = require('react-native');
    const weight = (tree: ReactTestRenderer, label: string) =>
      StyleSheet.flatten(
        tree.root
          .find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')
          .findByType(Text).props.style
      ).fontFamily;
    const all = mount({ filterType: 'all' as ActivityType });
    const spent = mount({ filterType: 'expense' as ActivityType });
    // "Show all" picked in one and not in the other: the same weight either way.
    expect(weight(all, 'Show all')).toBe(weight(spent, 'Show all'));
    expect(weight(spent, 'Show spent')).toBe(weight(spent, 'Show all'));
    act(() => all.unmount());
    act(() => spent.unmount());
  });
});

describe('what is picked comes and goes with a fade', () => {
  it('wraps each picked chip and Clear all in Appear, so none of them pops in or out', () => {
    const { CONTENT_ENTER } = require('@/lib/animation');
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 390, height: 800, scale: 3, fontScale: 1 });
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <ActivityFilterChips
          filterType={'expense' as ActivityType}
          onFilterType={jest.fn()}
          categoryIds={['food', 'fuel']}
          accountIds={['SBI']}
          expenseLabel="Lunch"
          categoryName={(id) => id}
          accountName={(id) => id}
          onRemoveCategory={jest.fn()}
          onRemoveAccount={jest.fn()}
          onRemoveLabel={jest.fn()}
          onClearAll={jest.fn()}
          onOpenFilters={jest.fn()}
        />
      );
    });
    const { View } = require('react-native');
    const fading = tree.root.findAll((n) => n.type === View && n.props.entering === CONTENT_ENTER);
    // Two categories, an account, a label and Clear all.
    expect(fading).toHaveLength(5);
    // The type pills are not among them: they never come or go.
    expect(
      fading.every((n) => n.findAll((c) => /^Show /.test(String(c.props.accessibilityLabel))).length === 0)
    ).toBe(true);
    act(() => tree.unmount());
  });
});
