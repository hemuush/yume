import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useGrowFrom } from '@/lib/useGrowFrom';

/**
 * A bar's fill whose width grows from what it last showed (useGrowFrom):
 * drawn in once after the app opens, still on a revisit, and gliding when
 * the value really changes — a payment, money added to a goal. Style it
 * like the plain fill View it replaces; this only owns the width.
 */
export function GrowFill({
  animKey,
  pct,
  style,
}: {
  /** Which bar this is, e.g. `loan:<id>` — see useGrowFrom. */
  animKey: string;
  /** 0-100. */
  pct: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useGrowFrom(animKey, Math.min(100, Math.max(0, pct)));
  const width = v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return <Animated.View style={[style, { width }]} />;
}
