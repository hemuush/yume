import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { Skeleton } from '@/components/Skeleton';
import { SoftCard } from './SoftCard';

export { CardRowsSkeleton, StripSkeleton } from '@/components/ListSkeleton';

const MOON_SIZE = 128;

/**
 * A slow scale pulse on the moon shape itself — the one thing on this
 * screen that's genuinely Yume's own rather than a generic gray bar. Same
 * withRepeat/cancelAnimation shape as `HomeHeader`'s `Spark`, not mixed
 * with core React Native's `Animated`.
 */
function BreathingMoon() {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(withTiming(1.045, { duration: 1050 }), -1, true);
    return () => cancelAnimation(scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <ReanimatedAnimated.View style={[styles.moonShape, animatedStyle]} />;
}

/**
 * Stands in for `ThisMonthHero` while Home's first load is still in
 * flight — the moon breathes instead of a static ₹0/0% flashing up and
 * then being overwritten a beat later, which is what this screen did
 * before it had any loading state at all.
 */
export function ThisMonthHeroSkeleton() {
  return (
    <SoftCard elevated backgroundColor={theme.colors.surface} style={styles.card}>
      <Skeleton width={68} height={11} radius={4} style={styles.centered} />
      <View style={styles.moonWrap}>
        <BreathingMoon />
      </View>
      <View style={styles.figsRow}>
        <FigSkeleton />
        <FigSkeleton />
      </View>
      <Skeleton width={150} height={9} radius={4} style={[styles.centered, { marginTop: 10 }]} />
      <View style={styles.divider} />
      <View style={styles.statRow}>
        <StatSkeleton />
        <StatSkeleton />
      </View>
    </SoftCard>
  );
}

function FigSkeleton() {
  return (
    <View style={styles.figCol}>
      <Skeleton width={34} height={8} radius={3} />
      <Skeleton width={58} height={13} radius={4} style={{ marginTop: 4 }} />
    </View>
  );
}

function StatSkeleton() {
  return (
    <View style={styles.stat}>
      <Skeleton width={14} height={14} circle radius={7} />
      <View style={{ flex: 1 }}>
        <Skeleton width={40} height={7} radius={3} />
        <Skeleton width={62} height={11} radius={4} style={{ marginTop: 5 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignSelf: 'center' },
  card: { marginHorizontal: 20, marginTop: 4, alignItems: 'center' },
  moonWrap: { width: MOON_SIZE, height: MOON_SIZE, marginTop: 14 },
  moonShape: {
    width: MOON_SIZE,
    height: MOON_SIZE,
    borderRadius: MOON_SIZE / 2,
    backgroundColor: theme.colors.surfaceAlt,
  },
  figsRow: { flexDirection: 'row', gap: 18, marginTop: 14 },
  figCol: { alignItems: 'center' },
  divider: { height: 1, backgroundColor: theme.colors.borderSoft, marginTop: 14, alignSelf: 'stretch' },
  statRow: { flexDirection: 'row', marginTop: 12, alignSelf: 'stretch', gap: 20 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
});
