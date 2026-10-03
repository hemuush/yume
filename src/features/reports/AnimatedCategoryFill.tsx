import { Animated } from 'react-native';
import { useGrowFrom } from '@/lib/useGrowFrom';

/**
 * One category row's track fill. Draws in from 0 the first time it shows after app open (staggered by `delay`
 * as a cascade); revisiting Reports moves nothing, and a new period glides old width to new (useGrowFrom).
 */
export function AnimatedCategoryFill({
  animKey,
  targetPct,
  color,
  delay,
}: {
  /** Which bar this is, so it remembers its last width — e.g. `reports:<categoryId>`. */
  animKey: string;
  targetPct: number;
  color: string;
  delay: number;
}) {
  const v = useGrowFrom(animKey, targetPct, { delay });
  const width = v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return <Animated.View style={{ width, height: '100%', borderRadius: 4, backgroundColor: color }} />;
}
