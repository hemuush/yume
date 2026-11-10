import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { screenStyles as h } from '@/components/screenStyles';

export { CardRowsSkeleton } from '@/components/ListSkeleton';

/**
 * Stands in for `ThisMonthHero` on Home's first load, in the cards' own shapes (label and month pill, the
 * figure, allowance pill, line and compact legend, then the Add buttons and the week card).
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
        <Skeleton width={Math.min(230, innerWidth)} height={48} radius={10} />
        <Skeleton width={Math.min(210, innerWidth)} height={30} radius={15} />
        <Skeleton width={innerWidth} height={12} radius={6} />
        <View style={styles.row}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={Math.max(0, Math.floor((innerWidth - 24) / 4))} height={32} radius={8} />
          ))}
        </View>
        <Skeleton width={Math.min(170, innerWidth)} height={18} radius={6} />
      </View>
      <View style={styles.actions}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={actionWidth} height={48} radius={14} />
        ))}
      </View>
      <View style={[styles.card, styles.week]}>
        <Skeleton width={Math.min(150, innerWidth)} height={28} radius={8} />
        <Skeleton width={innerWidth} height={102} radius={14} />
      </View>
    </>
  );
}

export function AccountTilesSkeleton() {
  return (
    <View style={styles.accountTiles}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width={152} height={120} radius={22} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...h.card, padding: 16, gap: 10 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  week: { marginTop: 16 },
  actions: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 10 },
  accountTiles: { marginHorizontal: 16, flexDirection: 'row', gap: 10, overflow: 'hidden' },
});
