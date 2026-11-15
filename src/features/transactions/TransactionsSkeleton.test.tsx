/**
 * The loading placeholder is drawn from the same parts as the page it stands in for, so the page fills in when the
 * data lands instead of reflowing: the Spent card, the filter row, then days with a heading above a card of entries.
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

it('draws the Spent card at the real card’s height, with its lettered bars, and not the old tall chart card', () => {
  const tree = render();
  const card = flat(tree).find((s) => s.minHeight === 98);
  expect(card).toBeDefined();
  // 7 bars for a week's days: 9 dp wide and rounded like the real ones.
  expect(flat(tree).filter((s) => s.width === 9 && s.borderRadius === 4)).toHaveLength(7);
  act(() => tree.unmount());
});

it('has the filter row (the Filters button and four choices) and two days each with a heading above its entries', () => {
  const tree = render();
  const styles = flat(tree);
  // 40 dp tall controls: the Filters circle and the four type choices, all fully round.
  const controls = styles.filter((s) => s.height === 40 && typeof s.width === 'number' && s.width !== 9);
  expect(controls).toHaveLength(5);
  expect(controls.every((s) => s.borderRadius === 20)).toBe(true);
  // No marker rail beside a day: its heading sits over the card, which runs the full width.
  expect(styles.filter((s) => s.width === 44 && s.alignItems === 'center')).toHaveLength(0);
  expect(styles.filter((s) => s.minHeight === 29)).toHaveLength(2);
  // 3 + 2 entries, each with a 34 dp category mark.
  expect(styles.filter((s) => s.width === 34 && s.height === 34)).toHaveLength(5);
  act(() => tree.unmount());
});
