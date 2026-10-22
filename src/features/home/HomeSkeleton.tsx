import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { screenStyles as h } from '@/components/screenStyles';

export { CardRowsSkeleton } from '@/components/ListSkeleton';

/**
 * Stands in for `ThisMonthHero` on Home's first load, in the cards' own shapes (label and month pill, the
 * figure, its line and legend, today's allowance, the three Add buttons), so nothing jumps when the real
 * cards replace it.
 */
export function ThisMonthHeroSkeleton() {
  const innerWidth = Math.max(0, useWindowDimensions().width - 66);
  const actionWidth = Math.max(0, Math.floor((innerWidth + 32 - 16) / 3));
  return (
    <>
      <View style={styles.card}>
        <View style={styles.bar}>
          <Skeleton width={84} height={12} radius={4} />
          <Skeleton width={96} height={32} radius={16} />
        </View>
        <Skeleton width={Math.min(150, innerWidth)} height={30} radius={8} />
        <Skeleton width={Math.min(170, innerWidth)} height={11} radius={4} />
        <Skeleton width={innerWidth} height={8} radius={4} />
        <View style={styles.row}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={Math.max(0, Math.floor((innerWidth - 16) / 3))} height={32} radius={8} />
          ))}
        </View>
      </View>
      <View style={[styles.card, styles.second]}>
        <Skeleton width={Math.min(190, innerWidth)} height={18} radius={6} />
        <Skeleton width={innerWidth} height={6} radius={3} />
      </View>
      <View style={styles.actions}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={actionWidth} height={50} radius={16} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { ...h.card, padding: 16, gap: 10 },
  second: { marginTop: 12 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  actions: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
});
