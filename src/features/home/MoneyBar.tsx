import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { timing } from '@/lib/animation';
import { useReduceMotion } from '@/lib/useReduceMotion';
import type { HeroSlices } from './heroSlices';
import { moneyBarSegments, MoneyBarSegment } from './moneyBarSegments';

const GROW_MS = 700;

/** One part of the bar, growing out from the left a beat after the one before it. */
function Segment({ segment, index }: { segment: MoneyBarSegment; index: number }) {
  const reduce = useReduceMotion();
  const growth = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    growth.value = reduce ? 1 : withDelay(300 + index * 120, withTiming(1, timing(GROW_MS)));
    return () => cancelAnimation(growth);
  }, [reduce, index, growth]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: growth.value }] }));
  return (
    <Animated.View
      style={[
        styles.segment,
        {
          flexGrow: segment.share,
          backgroundColor: theme.colors.slice[segment.key],
          marginLeft: index > 0 ? 3 : 0,
          transformOrigin: 'left',
        },
        segment.key === 'free' && styles.free,
        style,
      ]}
    />
  );
}

/**
 * A thin bar under the month card's figure: where the money went as spent, saved, still to pay and free, in
 * the colours of the Spent / Saved row. It shows at a glance why "free" is small or large. Decorative: the
 * figures below say the same in words.
 */
export function MoneyBar({ slices }: { slices: HeroSlices }) {
  const segments = moneyBarSegments(slices);
  if (segments.length === 0) return null;
  const used = segments.reduce((sum, s) => sum + s.share, 0);
  return (
    <View
      testID="home-money-bar"
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {segments.map((s, i) => (
        <Segment key={s.key} segment={s} index={i} />
      ))}
      {/* Savings hidden: the part that is not shown stays empty. */}
      {used < 0.999 && <View style={{ flexGrow: 1 - used, flexBasis: 0 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  segment: { flexBasis: 0, borderRadius: 4 },
  // A very small free part stays visible.
  free: { minWidth: 4 },
});
