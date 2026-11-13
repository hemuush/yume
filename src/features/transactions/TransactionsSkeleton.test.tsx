/**
 * The loading placeholder is drawn from the same parts as the page it stands in for, so the page fills in when the
 * data lands instead of reflowing: the slim Spent strip, the filter row, then days with a rail and a card of entries.
 */
import { StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));

import { TransactionsSkeleton } from './TransactionsSkeleton';

function render() {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<TransactionsSkeleton />);
  });
  return tree;
}

const flat = (tree: ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.type === 'string' && n.props.style)
    .map((n) => StyleSheet.flatten(n.props.style) ?? {});

it('draws a slim strip and not the old tall Spent card', () => {
  const tree = render();
  const strip = flat(tree).find((s) => s.minHeight === 64);
  expect(strip).toBeDefined();
  // The strip is a single 64 dp line: nothing in the placeholder is a tall card with a chart in it.
  expect(flat(tree).some((s) => typeof s.height === 'number' && s.height === 48)).toBe(false);
  act(() => tree.unmount());
});

it('has the filter row (the Filters button and four choices) and two days each with a rail and entries', () => {
  const tree = render();
  const styles = flat(tree);
  // 40 dp tall controls: the Filters circle and the four type choices.
  expect(styles.filter((s) => s.height === 40)).toHaveLength(5);
  // Each day carries a 44 dp rail beside its card.
  expect(styles.filter((s) => s.width === 44 && s.alignItems === 'center')).toHaveLength(2);
  // 3 + 2 entries, each with a 34 dp category mark.
  expect(styles.filter((s) => s.width === 34 && s.height === 34)).toHaveLength(5);
  act(() => tree.unmount());
});
