/**
 * The loading placeholder is drawn from the same parts as the page it stands in for, so the page fills in when the
 * data lands instead of reflowing: the Spent card, the filter row, then days with a heading above a card of entries.
 */
import { StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { theme } from '@/constants/theme';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
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

it('draws the Spent card at the real cardâ€™s height, with its lettered bars, and not the old tall chart card', () => {
  const tree = render();
  const card = flat(tree).find((s) => s.minHeight === 92);
  expect(card).toBeDefined();
  // 7 bars for a week's days: 9 dp wide and rounded like the real ones.
  expect(flat(tree).filter((s) => s.width === 9 && s.borderRadius === 4)).toHaveLength(7);
  act(() => tree.unmount());
});

it('has the filter row (the Filters button and four choices) and two days as Homeâ€™s card, each with its entries', () => {
  const tree = render();
  const styles = flat(tree);
  // 40 dp round shapes: the Filters circle and the four type choices (5), and the five category discs (5).
  const round = styles.filter((s) => s.height === 40 && typeof s.width === 'number' && s.borderRadius === 20);
  expect(round).toHaveLength(10);
  // No marker rail beside a day: the card (Home's, 12 dp inset) holds its heading and rows.
  expect(
    styles.filter((s) => s.width === 44 && s.alignItems === 'center' && s.height === undefined)
  ).toHaveLength(5);
  expect(
    styles.filter(
      (s) =>
        s.marginHorizontal === 16 &&
        s.borderWidth === StyleSheet.hairlineWidth &&
        s.borderRadius === theme.radius.lg
    )
  ).toHaveLength(2);
  expect(styles.filter((s) => s.minHeight === 29)).toHaveLength(2);
  // 3 + 2 entries, each with a 40 dp category disc like Home's.
  expect(styles.filter((s) => s.width === 40 && s.height === 40 && s.borderRadius === 20)).toHaveLength(6);
  act(() => tree.unmount());
});
