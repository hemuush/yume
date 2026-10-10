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

it('settles the native collapsing header without animation under reduced motion', () => {
  mockReduce = true;
  mockScroll.mockClear();
  function Harness() {
    const header = useCollapsingHeader();
    header.collapse.distance.value = 100;
    return null;
  }
  let root!: ReactTestRenderer;
  act(() => {
    root = create(<Harness />);
  });
  act(() => mockHandlers.onEndDrag({ contentOffset: { y: 70 }, velocity: { y: 0 } }));
  expect(mockScroll).toHaveBeenLastCalledWith(expect.anything(), 0, 100, false);
  act(() => mockHandlers.onMomentumEnd({ contentOffset: { y: 30 } }));
  expect(mockScroll).toHaveBeenLastCalledWith(expect.anything(), 0, 0, false);
  act(() => root.unmount());
  mockReduce = false;
});
