import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { DURATIONS } from './motionTimings';
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
 * A bar/ring value that grows from what it showed last: a new `key` draws in from 0, returning moves nothing,
 * a real change glides old → new; reduce motion = end value. Core `Animated`, JS driver (widths/SVG props).
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
  const previous = useRef({ key, target: lastShown.get(key) ?? 0 });

  // The durations are fixed per call site; only a new value or key moves the bar, so the effect starts the
  // animation through an Effect Event instead of depending on them.
  const animateTo = useEffectEvent((first: boolean) => {
    const animation = Animated.timing(v, {
      toValue: target,
      duration: first ? drawMs : changeMs,
      delay: first ? delay : 0,
      easing: Easing.out(Easing.cubic),
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
      v.setValue(remembered ?? 0);
      drawn.current = remembered !== undefined;
    }
    lastShown.set(key, target);
    const unchanged = changedKey ? remembered === target : previous.current.target === target;
    previous.current = { key, target };
    if (reduce || unchanged) {
      v.stopAnimation();
      v.setValue(target);
      drawn.current = true;
      return;
    }
    const first = !drawn.current;
    drawn.current = true;
    const animation = animateTo(first);
    return () => animation.stop();
  }, [key, target, reduce, v]);

  return v;
}
