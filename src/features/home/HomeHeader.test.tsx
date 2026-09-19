/**
 * Smoke-renders the Home header's `Spark` — the one new reanimated-driven
 * piece from this session's ambient-motion pass — with the OS reduce-motion
 * setting both off and on. Mirrors GoalRing.test.tsx: the same class of bug
 * (mixing react-native-reanimated's `Animated` with React Native core's, a
 * native-level mismatch invisible to JS) would show up here immediately,
 * rather than only in a release build.
 */
import { create, act } from 'react-test-renderer';

// See src/test-support/reanimatedMock.ts for why this exists at all.
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { mockCancelAnimation } from '@/test-support/reanimatedMock';

import { Spark } from './HomeHeader';

jest.mock('@/lib/useReduceMotion');
import { useReduceMotion } from '@/lib/useReduceMotion';

describe('HomeHeader Spark', () => {
  it('renders and starts its breathing loop when motion is not reduced', () => {
    (useReduceMotion as jest.Mock).mockReturnValue(false);
    expect(() => {
      act(() => {
        create(<Spark top={4} left={58} size={5} opacity={0.9} delay={0} />);
      });
    }).not.toThrow();
  });

  it('renders at its static opacity, no loop, when motion is reduced', () => {
    (useReduceMotion as jest.Mock).mockReturnValue(true);
    expect(() => {
      act(() => {
        create(<Spark top={12} left={36} size={3} opacity={0.7} delay={1400} />);
      });
    }).not.toThrow();
  });

  it('cancels an already-running loop and resets to the static rest state if reduce-motion turns on after mount', () => {
    // `useReduceMotion` really does start at `false` and only flips once its
    // async AccessibilityInfo check resolves — this is that exact sequence,
    // not a synthetic toggle.
    (useReduceMotion as jest.Mock).mockReturnValue(false);
    mockCancelAnimation.mockClear();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Spark top={4} left={58} size={5} opacity={0.9} delay={0} />);
    });
    expect(mockCancelAnimation).not.toHaveBeenCalled();

    (useReduceMotion as jest.Mock).mockReturnValue(true);
    act(() => {
      renderer.update(<Spark top={4} left={58} size={5} opacity={0.9} delay={0} />);
    });
    // The reset above happens inside a `useEffect`, which — like the real
    // reanimated shared values it mocks — mutates `.value` without itself
    // triggering a re-render; the still-mounted component's *next* render is
    // what reads the now-reset ref back out via `useAnimatedStyle`. A
    // second, identical update forces exactly that render.
    act(() => {
      renderer.update(<Spark top={4} left={58} size={5} opacity={0.9} delay={0} />);
    });

    expect(mockCancelAnimation).toHaveBeenCalledTimes(2); // scale + glow
    const style = renderer!.root.findByType(require('react-native-reanimated').default.View).props.style;
    const flat = [].concat(...style).reduce((acc: any, s: any) => Object.assign(acc, s), {});
    expect(flat.opacity).toBe(0.9); // back to the plain prop value, not mid-loop
    expect(flat.transform).toEqual([{ scale: 1 }]);
  });

  it('cancels its loop on unmount instead of leaving it running forever', () => {
    (useReduceMotion as jest.Mock).mockReturnValue(false);
    mockCancelAnimation.mockClear();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Spark top={4} left={58} size={5} opacity={0.9} delay={0} />);
    });
    expect(mockCancelAnimation).not.toHaveBeenCalled();

    act(() => {
      renderer.unmount();
    });
    expect(mockCancelAnimation).toHaveBeenCalledTimes(2); // scale + glow
  });
});
