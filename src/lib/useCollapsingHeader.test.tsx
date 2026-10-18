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

it('keeps a partially collapsed header at the reader scroll offset, and re-reads where the list stops', () => {
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
  // A throttled last scroll event can miss the resting position: lifting the finger and the end of the momentum
  // both record the true offset (a list that settles at its top reads 0), without any snap or second scroll.
  act(() => mockHandlers.onEndDrag?.({ contentOffset: { y: 36 } }));
  expect(state.collapse.scrollY.value).toBe(36);
  act(() => mockHandlers.onMomentumEnd?.({ contentOffset: { y: 0 } }));
  expect(state.collapse.scrollY.value).toBe(0);
  act(() => mockHandlers.onScroll?.({ contentOffset: { y: 35 } }));
  act(() => state.onJsScroll(42));
  expect(state.collapse.scrollY.value).toBe(42);
  // The keyboard-aware views record where they stop in the same way.
  act(() => state.onJsScrollEnd({ nativeEvent: { contentOffset: { y: 0 } } } as never));
  expect(state.collapse.scrollY.value).toBe(0);
  act(() => state.resetScroll());
  expect(state.collapse.scrollY.value).toBe(0);
  act(() => tree.unmount());
});
