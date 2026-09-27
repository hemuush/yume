import { Animated } from 'react-native';
import { useGrowFrom } from '@/lib/useGrowFrom';

/**
 * One category row's track fill. It draws in from 0 the first time the
 * category shows after the app opens (staggered per row by `delay`, so the
 * list reads as one cascading reveal); after that, coming back to Reports
 * moves nothing, and a new period glides each bar from its old width to
 * its new one (useGrowFrom).
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
