import { useEffect } from 'react';
import { cancelAnimation, SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { timing } from './animation';
import { DURATIONS } from './motionTimings';
import { useReduceMotion } from './useReduceMotion';

/** The last value each mark showed while the app has been open (module state: it outlives the screen). */
const lastShown = new Map<string, number>();

/**
 * A shared value for a bar, line or ring on the UI thread (smooth even while JavaScript is busy): it shows its value
 * at once (nothing draws in from empty), a key seen before keeps what it showed, a real change glides old to new,
 * and reduced motion goes straight to the end.
 */
export function useDrawnValue(
  key: string,
  target: number,
  duration: number = DURATIONS.standard
): SharedValue<number> {
  const reduce = useReduceMotion();
  const value = useSharedValue(reduce ? target : (lastShown.get(key) ?? target));
  useEffect(() => {
    const from = lastShown.get(key) ?? target;
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
