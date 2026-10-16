import { View } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

const mockReaction: { prepare?: () => number; react?: (now: number, prev: number | null) => void } = {};
const mockScroll = jest.fn();
let mockHandlers: Record<string, (event: unknown) => void>;
let mockReduce = false;
jest.mock('react-native-reanimated', () => ({
  ...require('@/test-support/reanimatedMock').createReanimatedMock(),
  useAnimatedReaction: (prepare: () => number, react: (now: number, prev: number | null) => void) => {
    mockReaction.prepare = prepare;
    mockReaction.react = react;
  },
  useAnimatedScrollHandler: (handlers: typeof mockHandlers) => {
    mockHandlers = handlers;
    return handlers;
  },
  scrollTo: (...args: unknown[]) => mockScroll(...args),
}));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('@/features/home/SkyBackdrop', () => ({ SkyBackdrop: () => null }));

import { SkyHeader } from './SkyHeader';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';

it('keeps invisible period controls out of touch/focus and avoids compact-chip flicker', () => {
  const scrollY = { value: 0 };
  const distance = { value: 100 };
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <SkyHeader
        title="Activity"
        collapse={
          {
            scrollY,
            distance,
            onMeasure: jest.fn(),
          } as never
        }
        collapsedAccessory={<View testID="compact-period" />}
      >
        <View testID="expanded-period" />
      </SkyHeader>
    );
  });
  const state = (id: string) => root.root.findByProps({ testID: id }).parent!.props;
  let prev: number | null = null;
  const move = (y: number) => {
    scrollY.value = y;
    act(() => {
      const now = mockReaction.prepare!();
      mockReaction.react!(now, prev);
      prev = now;
    });
  };
  expect(state('compact-period').pointerEvents).toBe('none');
  move(51);
  expect(state('compact-period').pointerEvents).toBe('none');
  expect(state('expanded-period').pointerEvents).toBe('none');
  move(91);
  expect(state('compact-period').pointerEvents).toBe('auto');
  move(89);
  expect(state('compact-period').pointerEvents).toBe('auto');
  move(74);
  expect(state('compact-period').pointerEvents).toBe('none');
  move(0);
  expect(state('expanded-period').pointerEvents).toBe('auto');
  act(() => root.unmount());
});

it.each([false, true])(
  'preserves the native scroll offset without a release snap (reduced motion: %s)',
  (reduce) => {
    mockReduce = reduce;
    mockScroll.mockClear();
    let header!: ReturnType<typeof useCollapsingHeader>;
    function Harness() {
      header = useCollapsingHeader();
      header.collapse.distance.value = 100;
      return null;
    }
    let root!: ReactTestRenderer;
    act(() => {
      root = create(<Harness />);
    });
    try {
      act(() => mockHandlers.onScroll({ contentOffset: { y: 70 } }));
      expect(header.collapse.scrollY.value).toBe(70);
      expect(mockHandlers.onEndDrag).toBeUndefined();
      expect(mockHandlers.onMomentumEnd).toBeUndefined();
      act(() => mockHandlers.onScroll({ contentOffset: { y: 30 } }));
      expect(header.collapse.scrollY.value).toBe(30);
      expect(mockScroll).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      mockReduce = false;
    }
  }
);

it('keeps a larger title row visible after font scaling changes its measured height', () => {
  const onMeasure = jest.fn();
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <SkyHeader
        title="Plan"
        hideUser
        collapse={{ scrollY: { value: 0 }, distance: { value: 0 }, onMeasure } as never}
      />
    );
  });
  const layouts = root.root.findAll(
    (node) => node.type === View && typeof node.props.onLayout === 'function'
  );
  const event = (height: number) => ({ nativeEvent: { layout: { height } } });
  act(() => layouts[0].props.onLayout(event(150)));
  expect(onMeasure).toHaveBeenLastCalledWith(150, 94);
  act(() => layouts[1].props.onLayout(event(64)));
  expect(onMeasure).toHaveBeenLastCalledWith(150, 74);
  act(() => root.unmount());
});
