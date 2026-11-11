import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { EASE_OUT, DURATIONS } from '@/lib/motionTimings';
import { Animated } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * The last value each bar or ring showed, for as long as the app is open. Module state on purpose: it must
 * outlive the component, which unmounts when you leave the screen.
 */
const lastShown = new Map<string, number>();

/** Test hook: forget every remembered value, as a fresh app launch would. */
export function resetGrowMemory(): void {
  lastShown.clear();
}

/**
 * A bar/ring/line value that shows where it is at once and glides only when it really changes: a new `key` starts
 * at its value (nothing draws in from empty), returning moves nothing, a real change glides old → new; reduce
 * motion = end value. Core `Animated`, JS driver (widths/SVG props).
 */
export function useGrowFrom(
  key: string,
  target: number,
  { changeMs = DURATIONS.standard }: { changeMs?: number } = {}
): Animated.Value {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(lastShown.get(key) ?? target));
  const previous = useRef({ key, target: lastShown.get(key) ?? target });

  // The duration is fixed per call site; only a new value or key moves the bar, so the effect starts the
  // animation through an Effect Event instead of depending on it.
  const animateTo = useEffectEvent(() => {
    const animation = Animated.timing(v, {
      toValue: target,
      duration: changeMs,
      easing: EASE_OUT,
      useNativeDriver: false,
    });
    animation.start();
    return animation;
  });

  useEffect(() => {
    const changedKey = previous.current.key !== key;
    const remembered = lastShown.get(key);
    if (changedKey) {
      v.stopAnimation();
      v.setValue(remembered ?? target);
    }
    lastShown.set(key, target);
    const unchanged = changedKey ? (remembered ?? target) === target : previous.current.target === target;
    previous.current = { key, target };
    if (reduce || unchanged) {
      v.stopAnimation();
      v.setValue(target);
      return;
    }
    const animation = animateTo();
    return () => animation.stop();
  }, [key, target, reduce, v]);

  return v;
}
