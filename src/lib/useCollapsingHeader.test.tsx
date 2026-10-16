import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

let mockHandlers: Record<string, ((event: any) => void) | undefined> = {};
jest.mock('react-native-reanimated', () => ({
  ...require('@/test-support/reanimatedMock').createReanimatedMock(),
  useAnimatedScrollHandler: (handlers: typeof mockHandlers) => {
    mockHandlers = handlers;
    return () => {};
  },
}));
import { useCollapsingHeader } from './useCollapsingHeader';

it('keeps a partially collapsed header at the reader scroll offset without a release snap', () => {
  let state!: ReturnType<typeof useCollapsingHeader>;
  function Screen() {
    state = useCollapsingHeader();
    return <Text>Screen</Text>;
  }
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<Screen />);
  });
  act(() => state.collapse.onMeasure(160, 80));
  act(() => mockHandlers.onScroll?.({ contentOffset: { y: 35 } }));
  expect(state.collapse.scrollY.value).toBe(35);
  expect(state.headerHeight).toBe(160);
  expect(state.collapsedHeight).toBe(80);
  expect(mockHandlers.onEndDrag).toBeUndefined();
  expect(mockHandlers.onMomentumEnd).toBeUndefined();
  act(() => state.onJsScroll(42));
  expect(state.collapse.scrollY.value).toBe(42);
  act(() => state.resetScroll());
  expect(state.collapse.scrollY.value).toBe(0);
  act(() => tree.unmount());
});
