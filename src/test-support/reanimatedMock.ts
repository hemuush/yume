import { View, Text, ScrollView } from 'react-native';
import { useRef } from 'react';

/**
 * Stand-in for react-native-reanimated (its own mock needs the native worklets runtime): Animated.View,
 * chainable FadeIn builders, ReduceMotion, no-op hooks. Use via jest.mock factory; `require` it lazily inside.
 */
export const mockCancelAnimation = jest.fn();

export function createReanimatedMock() {
  const chainable = () => chainableProxy;
  const chainableProxy: any = new Proxy(chainable, { get: () => chainable });
  return {
    __esModule: true,
    // Text too: PrimaryButton renders a ReanimatedAnimated.Text for its label.
    default: { View, Text, ScrollView, createAnimatedComponent: (Component: unknown) => Component },
    FadeIn: chainableProxy,
    FadeInDown: chainableProxy,
    FadeOut: chainableProxy,
    FadeOutDown: chainableProxy,
    LinearTransition: chainableProxy,
    ReduceMotion: { System: 'system' },
    // A real useRef, not a fresh object per render: otherwise a rerender would "reset" a shared value and
    // defeat tests that check state survives across renders.
    useSharedValue: (initial: unknown) => useRef({ value: initial }).current,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    // Home's month ring and the debt tick draw through animated SVG props.
    useAnimatedProps: (fn: () => unknown) => fn(),
    interpolate: (value: number, input: number[], output: number[]) => {
      const i = Math.max(
        0,
        input.findIndex((x, k) => value <= x || k === input.length - 1)
      );
      return output[Math.min(i, output.length - 1)];
    },
    Extrapolation: { CLAMP: 'clamp' },
    withRepeat: (toValue: unknown) => toValue,
    withTiming: (toValue: unknown) => toValue,
    withDelay: (_delay: number, toValue: unknown) => toValue,
    cancelAnimation: (...args: unknown[]) => mockCancelAnimation(...args),
    // src/lib/animation.ts builds its shared curve at import time.
    Easing: {
      out: (f: unknown) => f,
      in: (f: unknown) => f,
      inOut: (f: unknown) => f,
      cubic: (t: number) => t,
      quad: (t: number) => t,
      linear: (t: number) => t,
    },
    // Home's collapsing header: a scroll handler that never fires, and a
    // reaction that never runs outside a real UI thread.
    useAnimatedScrollHandler: () => () => {},
    useAnimatedReaction: () => {},
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
  };
}
