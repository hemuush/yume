import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';

interface Props {
  /** Pixel width — needs to be a real number (not a percentage string) so the shimmer sweep's own travel distance can be computed from it. */
  width: number;
  height: number;
  radius?: number;
  circle?: boolean;
  style?: object;
}

/**
 * One skeleton shape — a soft base tint with a light gradient band sweeping
 * across it on a loop, the shared building block for every screen's
 * loading state (see Home's own `ThisMonthHero`/section skeletons, the
 * first to use this). Built entirely on `react-native-reanimated`'s own
 * shared values, the same pattern `HomeHeader`'s `Spark` already
 * established for a looping animation — never mixed with core React
 * Native's `Animated`, which is exactly the import mismatch that crashed
 * BudgetRow/GoalCard/GoalChip in an earlier session. `useReduceMotion`
 * freezes the sweep at a static half-lit look instead of looping it.
 */
export function Skeleton({ width, height, radius = 6, circle = false, style }: Props) {
  const reduce = useReduceMotion();
  const sweep = useSharedValue(-1);

  useEffect(() => {
    if (reduce) {
      sweep.value = 0;
      return;
    }
    sweep.value = withRepeat(withTiming(1, { duration: 1300 }), -1, false);
    return () => cancelAnimation(sweep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const bandWidth = Math.max(24, width * 0.6);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (sweep.value + 1) * ((width + bandWidth) / 2) - bandWidth }],
  }));

  const r = circle ? height / 2 : radius;

  return (
    <View
      style={[
        { width, height, borderRadius: r, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
        style,
      ]}
    >
      {!reduce && (
        <ReanimatedAnimated.View style={[StyleSheet.absoluteFill, { width: bandWidth }, animatedStyle]}>
          <LinearGradient
            colors={['transparent', theme.colors.surface, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </ReanimatedAnimated.View>
      )}
    </View>
  );
}
