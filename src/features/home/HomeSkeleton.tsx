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

/** The same size as the month card's ring, so nothing moves when the real card replaces this. */
const RING_SIZE = 104;

/**
 * A slow scale pulse on the ring shape itself — the one thing on this
 * screen that's genuinely Yume's own rather than a generic gray bar. Same
 * withRepeat/cancelAnimation shape as `HomeHeader`'s `Spark`, not mixed
 * with core React Native's `Animated`.
 */
function BreathingRing() {
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

  return <ReanimatedAnimated.View style={[styles.ringShape, animatedStyle]} />;
}

/**
 * Stands in for `ThisMonthHero` while Home's first load is still in flight,
 * in the card's own shape (the Home A sign-off: ring, four tiles, two slim
 * lines, a footer) — the ring breathes instead of a static ₹0/0% flashing up
 * and then being overwritten a beat later.
 */
export function ThisMonthHeroSkeleton() {
  return (
    <SoftCard elevated backgroundColor={theme.colors.surface} padding={0} style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.bar}>
          <Skeleton width={80} height={11} radius={4} />
          <Skeleton width={96} height={11} radius={4} />
        </View>
        <View style={styles.top}>
          <BreathingRing />
          <View style={styles.tiles}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.tile}>
                <Skeleton width={46} height={7} radius={3} />
                <Skeleton width={62} height={12} radius={4} style={{ marginTop: 8 }} />
              </View>
            ))}
          </View>
        </View>
        <Skeleton width={200} height={10} radius={4} style={{ marginTop: 16 }} />
        <Skeleton width={170} height={10} radius={4} style={{ marginTop: 12 }} />
      </View>
      <View style={styles.footer} />
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 4, overflow: 'hidden' },
  inner: { padding: 16, paddingBottom: 14 },
  bar: { flexDirection: 'row', justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  ringShape: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 9,
    borderColor: theme.colors.surfaceAlt,
  },
  tiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tile: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceAlt,
  },
  footer: { height: 40, backgroundColor: theme.colors.surfaceAlt },
});
