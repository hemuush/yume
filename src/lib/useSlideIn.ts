import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { DURATIONS } from './motionTimings';
import { useReduceMotion } from './useReduceMotion';

/** How far the new period's figures start to the side. */
const SLIDE_PX = 18;

/**
 * Slides a block in from the side when `pageKey` changes (a new period on
 * Reports), from the side you moved toward: back in time comes in from the
 * left, forward from the right. `direction` 0 (a custom range) just fades.
 * Nothing on first mount; reduce motion: nothing at all.
 */
export function useSlideIn(pageKey: string, direction: -1 | 0 | 1) {
  const reduce = useReduceMotion();
  const [x] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const lastKey = useRef(pageKey);

  useEffect(() => {
    if (lastKey.current === pageKey) return;
    lastKey.current = pageKey;
    if (reduce) return;
    x.setValue(direction * SLIDE_PX);
    opacity.setValue(0);
    const cfg = {
      toValue: 0,
      duration: DURATIONS.slideIn,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    };
    Animated.parallel([Animated.timing(x, cfg), Animated.timing(opacity, { ...cfg, toValue: 1 })]).start();
    // `direction` is read with the key that it came with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, reduce]);

  return { opacity, transform: [{ translateX: x }] };
}
