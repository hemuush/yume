import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useDrawnValue } from '@/lib/useDrawnValue';

/**
 * A bar fill whose width grows on the UI thread: drawn in once after app open,
 * still on revisit, gliding on real change. Style it like the plain fill View; this only owns the width.
 */
export function GrowFill({
  animKey,
  pct,
  style,
}: {
  /** Which bar this is, e.g. `loan:<id>` — see useDrawnValue. */
  animKey: string;
  /** 0-100. */
  pct: number;
  style?: StyleProp<ViewStyle>;
}) {
  const value = useDrawnValue(animKey, Math.min(100, Math.max(0, pct)));
  const animatedStyle = useAnimatedStyle(() => ({ width: `${value.value}%` as `${number}%` }));
  return <Animated.View style={[style, animatedStyle]} />;
}
