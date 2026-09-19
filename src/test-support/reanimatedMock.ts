import { View } from 'react-native';
import { useRef } from 'react';

/**
 * react-native-reanimated needs the native worklets runtime even for its own
 * official mock.js — this stands in with just enough surface for what the
 * app actually imports from it in tests that smoke-render a component
 * without a real device (Spark's breathing loop, Suu's idle breathing,
 * MoonPhase's entrance fade): `Animated.View`, the `FadeIn`/`FadeInDown`
 * entrance builders (chainable, since call sites chain `.duration()`/
 * `.springify()`/`.reduceMotion()` off them, but never actually invoked
 * outside a real renderer), `ReduceMotion`, and the
 * useSharedValue/useAnimatedStyle/withTiming/withRepeat/withDelay/
 * cancelAnimation primitives — all no-ops that carry a `.value` through
 * rather than running a real worklet.
 *
 * Used via `jest.mock('react-native-reanimated', () =>
 * require('@/test-support/reanimatedMock').createReanimatedMock())` — the
 * `require` inside the factory (not a top-level import) is deliberate:
 * `jest.mock` factories run before Jest finishes hoisting imports, so
 * anything the factory needs must be pulled in lazily, at the point some
 * other module actually requires 'react-native-reanimated'.
 */
export const mockCancelAnimation = jest.fn();

export function createReanimatedMock() {
  const chainable = () => chainableProxy;
  const chainableProxy: any = new Proxy(chainable, { get: () => chainable });
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (Component: unknown) => Component },
    FadeIn: chainableProxy,
    FadeInDown: chainableProxy,
    ReduceMotion: { System: 'system' },
    // A real useRef, not a fresh object per render — otherwise a rerender
    // would trivially "reset" a shared value on its own, defeating any test
    // that checks state survives across renders.
    useSharedValue: (initial: unknown) => useRef({ value: initial }).current,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withRepeat: (toValue: unknown) => toValue,
    withTiming: (toValue: unknown) => toValue,
    withDelay: (_delay: number, toValue: unknown) => toValue,
    cancelAnimation: (...args: unknown[]) => mockCancelAnimation(...args),
  };
}
