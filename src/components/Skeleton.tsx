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
 * One skeleton shape: a soft tint with a gradient band sweeping in a loop. Reanimated shared values only;
 * never mix core RN `Animated` (that mismatch crashed BudgetRow/GoalCard/GoalChip). Reduce motion freezes it.
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
  }, [reduce, sweep]);

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
