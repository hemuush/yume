import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * Numbers that glide to their new values instead of jumping: Home's moon and ring follow the month's figures
 * this way, including while a finger travels the day rail. Starts at the first values (no count-up from zero).
 * Core Animated with a JS listener, like CountUpAmount, so it needs no native module; with reduced motion
 * every change lands at once.
 */
export function useEasedNumbers(target: readonly number[], duration: number): number[] {
  const reduce = useReduceMotion();
  const key = target.join('|');
  const [shown, setShown] = useState<number[]>(() => [...target]);
  const current = useRef<number[]>([...target]);

  useEffect(() => {
    const to = key === '' ? [] : key.split('|').map(Number);
    const from = current.current.length === to.length ? current.current : to;
    if (reduce || from.every((v, i) => v === to[i])) {
      current.current = to;
      setShown(to);
      return;
    }
    const t = new Animated.Value(0);
    const id = t.addListener(({ value }) => {
      const next = to.map((v, i) => from[i] + (v - from[i]) * value);
      current.current = next;
      setShown(next);
    });
    const animation = Animated.timing(t, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      // Cut short by a newer target: that run carries on from where this one stopped, not from its end.
      if (finished) {
        current.current = to;
        setShown(to);
      }
    });
    return () => {
      animation.stop();
      t.removeListener(id);
    };
  }, [key, reduce, duration]);

  return shown;
}
