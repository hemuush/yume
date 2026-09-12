import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * One category row's track fill, growing in from 0 on mount — the same
 * `Animated.timing` width-interpolation `ThisMonthHero`'s own spend/kept bar
 * already uses, just staggered per row by index so the list reads as one
 * cascading reveal rather than every bar snapping in at once.
 */
export function AnimatedCategoryFill({
  targetPct,
  color,
  delay,
}: {
  targetPct: number;
  color: string;
  delay: number;
}) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));

  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 480, delay, useNativeDriver: false }).start();
    // Re-running only when the target itself changes (a period switch), not
    // on every unrelated re-render of the list this row lives in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPct, reduce]);

  const width = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${targetPct}%`] });

  return <Animated.View style={{ width, height: '100%', borderRadius: 4, backgroundColor: color }} />;
}
