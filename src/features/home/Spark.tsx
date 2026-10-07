import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * One spark in a sky header (Home, Reports) breathing twice on open (scale+opacity), staggered by `delay` so
 * the sparks never sync.
 * Reanimated only, never core Animated (that mix crashed BudgetRow/GoalCard); reduce-motion skips the loop.
 */
/** Out and back counts as two: 4 is two pulses, ending where it started. */
const SPARK_REPEATS = 4;

export function Spark({
  top,
  left,
  size,
  opacity,
  delay,
}: {
  top: number;
  left: number;
  size: number;
  opacity: number;
  delay: number;
}) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const glow = useSharedValue(opacity);

  useEffect(() => {
    if (reduce) {
      // `useReduceMotion` starts `false` and flips after an async check; if that lands after the loop began,
      // the cleanup already cancelled it, so this just snaps values back to the static rest state.
      scale.value = 1;
      glow.value = opacity;
      return;
    }
    // Two pulses (out and back, twice) when Home opens, then still: constant
    // motion is the opposite of calm (the Quiet motion sign-off).
    scale.value = withDelay(delay, withRepeat(withTiming(1.4, { duration: 1400 }), SPARK_REPEATS, true));
    glow.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400 }), SPARK_REPEATS, true));
    // Runs before every re-run of this effect (a reduce-motion flip) and on
    // unmount, so a pulse still running when Home goes away stops with it.
    return () => {
      cancelAnimation(scale);
      cancelAnimation(glow);
    };
  }, [reduce, delay, opacity, scale, glow]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: glow.value,
  }));

  return (
    <ReanimatedAnimated.View
      style={[
        styles.spark,
        { top, left: `${left}%`, width: size, height: size, borderRadius: size / 2 },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  spark: { position: 'absolute', backgroundColor: theme.colors.surface },
});
