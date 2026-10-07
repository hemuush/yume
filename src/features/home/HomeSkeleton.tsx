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
import { SoftCard } from '@/components/SoftCard';
import { STACK, stackHeight } from './stackLayout';

export { CardRowsSkeleton } from '@/components/ListSkeleton';

/** The same size as the month card's ring, so nothing moves when the real card replaces this. */
const RING_SIZE = 104;

/**
 * Slow scale pulse on the ring shape, the one Yume-specific bit of this screen. Same
 * withRepeat/cancelAnimation shape as `HomeHeader`'s `Spark`; reanimated only, never core `Animated`.
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
  }, [reduce, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <ReanimatedAnimated.View style={[styles.ringShape, animatedStyle]} />;
}

/**
 * Stands in for `ThisMonthHero` on Home's first load, in the card's own shape (figure, ring, legend, tray,
 * footer). The ring breathes so a static ₹0/0% doesn't flash up and get overwritten a beat later.
 */
export function ThisMonthHeroSkeleton() {
  return (
    <SoftCard
      elevated
      backgroundColor={theme.colors.surface}
      borderRadius={26}
      padding={0}
      style={styles.card}
    >
      <View style={styles.inner}>
        <View style={styles.bar}>
          <Skeleton width={84} height={12} radius={4} />
          <Skeleton width={70} height={12} radius={4} />
        </View>
        <View style={styles.top}>
          <View style={styles.headline}>
            <Skeleton width={96} height={10} radius={4} />
            <Skeleton width={160} height={32} radius={6} style={{ marginTop: 10 }} />
            <Skeleton width={130} height={11} radius={4} style={{ marginTop: 10 }} />
          </View>
          <BreathingRing />
        </View>
        <View style={styles.legend}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.legendItem}>
              <Skeleton width={52} height={9} radius={3} />
              <Skeleton width={70} height={13} radius={4} style={{ marginTop: 9 }} />
            </View>
          ))}
        </View>
        <View style={styles.tray}>
          <Skeleton width={200} height={11} radius={4} />
          <Skeleton width={170} height={11} radius={4} style={{ marginTop: 12 }} />
        </View>
      </View>
      <View style={styles.footer} />
    </SoftCard>
  );
}

/**
 * Stands in for the account stack: three overlapping cards, the same shape and height it will have, so
 * nothing jumps when it loads.
 */
export function AccountStackSkeleton() {
  return (
    <View style={[styles.stack, { height: stackHeight(3) }]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.stackCard, { top: i * STACK.peek, zIndex: i }]}>
          <Skeleton width={22} height={22} circle radius={11} />
          <Skeleton width={90} height={11} radius={4} />
          <View style={{ flex: 1 }} />
          <Skeleton width={56} height={11} radius={4} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { marginHorizontal: 20 },
  stackCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: STACK.cardHeight,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  card: { marginHorizontal: 20, marginTop: 4, overflow: 'hidden' },
  inner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  bar: { flexDirection: 'row', justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  ringShape: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 10,
    borderColor: theme.colors.surfaceAlt,
  },
  headline: { flex: 1, minWidth: 0 },
  legend: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  legendItem: { flex: 1, minHeight: 48, justifyContent: 'center' },
  tray: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: theme.colors.tray },
  footer: { height: 48, backgroundColor: theme.colors.surfaceAlt },
});
