import { useEffect } from 'react';
import { cancelAnimation, SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { timing } from './animation';
import { DURATIONS } from './motionTimings';
import { useReduceMotion } from './useReduceMotion';

/** The last value each mark showed while the app has been open (module state: it outlives the screen). */
const lastShown = new Map<string, number>();

/** Test hook: forget every remembered value, as a fresh app launch would. */
export function resetDrawnMemory(): void {
  lastShown.clear();
}

/**
 * A shared value for a bar, line or ring that draws on the UI thread (smooth even while JavaScript is busy):
 * a new `key` draws in from 0, a key seen before keeps what it showed, a real change glides old to new, and
 * reduced motion goes straight to the end. The UI-thread twin of useGrowFrom.
 */
export function useDrawnValue(
  key: string,
  target: number,
  duration: number = DURATIONS.draw
): SharedValue<number> {
  const reduce = useReduceMotion();
  const value = useSharedValue(reduce ? target : (lastShown.get(key) ?? 0));
  useEffect(() => {
    const from = lastShown.get(key) ?? 0;
    lastShown.set(key, target);
    if (reduce || from === target) {
      value.value = target;
      return;
    }
    value.value = from;
    value.value = withTiming(target, timing(duration));
    return () => cancelAnimation(value);
  }, [key, target, duration, reduce, value]);
  return value;
}
