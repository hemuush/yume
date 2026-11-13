/** The loading placeholder is the Overview's two cards at the loaded page's width and top gap, not a guess. */
import { StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));

import { ReportsSkeleton } from './ReportsSkeleton';

it('draws a short summary card then a tall calendar card, as wide as the loaded cards and below the same gap', () => {
  const dimensions = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 400, height: 800, fontScale: 1, scale: 1 });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<ReportsSkeleton />);
  });
  const blocks = tree.root
    .findAll((n) => typeof n.type === 'string' && n.props.style)
    .map((n) => StyleSheet.flatten(n.props.style) ?? {})
    .filter((s) => typeof s.height === 'number' && s.height >= 100);
  // 400 wide less a 16 dp gutter each side.
  expect(blocks.map((b) => [b.width, b.height])).toEqual([
    [368, 124],
    [368, 440],
  ]);
  const wrap = tree.root.findByProps({ accessibilityLabel: 'Loading report' });
  expect(StyleSheet.flatten(wrap.props.style)).toMatchObject({ paddingHorizontal: 16, paddingTop: 12 });
  act(() => tree.unmount());
  dimensions.mockRestore();
});
