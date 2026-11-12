import { useEffect, useRef } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { DURATIONS } from '@/lib/motionTimings';
import { timing } from '@/lib/animation';

/**
 * The glide a period's figures make when the period steps: they enter 18 dp from the side they came from
 * (`direction`: +1 forward, -1 back, 0 for a scope switch or a picked month: a plain fade) while fading in.
 * Nothing moves on first show, when the period is unchanged, or under reduce-motion. Used by Activity's Spent
 * strip and its Insights figures, so both turn the page the same way.
 */
export function usePeriodSlide(periodKey: string, direction: -1 | 0 | 1) {
  const reduce = useReduceMotion();
  const prevPeriodKey = useRef(periodKey);
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  const directionRef = useRef(direction);
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    cancelAnimation(tx);
    cancelAnimation(opacity);
    const changed = prevPeriodKey.current !== periodKey;
    prevPeriodKey.current = periodKey;
    tx.value = 0;
    opacity.value = 1;
    if (changed && !reduce) {
      tx.value = directionRef.current * 18;
      opacity.value = 0;
      tx.value = withTiming(0, timing(DURATIONS.slideIn));
      opacity.value = withTiming(1, timing(DURATIONS.slideIn));
    }
    return () => {
      cancelAnimation(tx);
      cancelAnimation(opacity);
    };
  }, [periodKey, reduce, tx, opacity]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }], opacity: opacity.value }));
}
