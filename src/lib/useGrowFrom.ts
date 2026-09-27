import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { DURATIONS } from './motionTimings';
import { useReduceMotion } from './useReduceMotion';

/**
 * The last value each bar or ring showed, for as long as the app is open.
 * Module state on purpose: it has to outlive the component, which unmounts
 * when you leave the screen and mounts fresh when you come back.
 */
const lastShown = new Map<string, number>();

/** Test hook: forget every remembered value, as a fresh app launch would. */
export function resetGrowMemory(): void {
  lastShown.clear();
}

/**
 * A bar's or ring's value that grows from what it showed last time (the
 * Quiet motion sign-off): the first time a `key` is seen after the app
 * opens it draws in from 0; after that, coming back to the screen moves
 * nothing, and a real change (money added, a new month) glides from the old
 * value to the new one. Reduce motion: always the plain end value.
 *
 * Core `Animated` (not Reanimated), with `useNativeDriver: false`, since it
 * drives widths and SVG props.
 */
export function useGrowFrom(
  key: string,
  target: number,
  {
    drawMs = DURATIONS.draw,
    changeMs = DURATIONS.standard,
    delay = 0,
  }: { drawMs?: number; changeMs?: number; delay?: number } = {}
): Animated.Value {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(lastShown.get(key) ?? 0));
  const drawn = useRef(lastShown.has(key));

  useEffect(() => {
    lastShown.set(key, target);
    if (reduce) {
      v.stopAnimation();
      v.setValue(target);
      drawn.current = true;
      return;
    }
    const first = !drawn.current;
    drawn.current = true;
    Animated.timing(v, {
      toValue: target,
      duration: first ? drawMs : changeMs,
      delay: first ? delay : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // The durations are fixed per call site; only a new value or key moves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, target, reduce]);

  return v;
}
