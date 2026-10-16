import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';

export { CardRowsSkeleton } from '@/components/ListSkeleton';

/**
 * Stands in for `ThisMonthHero` on Home's first load, in the card's own shape (label and month pill, the big
 * figure beside the moon, its chip, the day rail, the three Add buttons), so nothing jumps when the real card replaces it.
 */
export function ThisMonthHeroSkeleton() {
  const innerWidth = Math.max(0, useWindowDimensions().width - 62);
  const actionWidth = Math.max(0, Math.floor((innerWidth - 16) / 3));
  return (
    <Glass radius={28} style={[styles.card, cardSurface.summary]}>
      <View style={styles.bar}>
        <Skeleton width={84} height={12} radius={4} />
        <Skeleton width={96} height={30} radius={15} />
      </View>
      <View style={styles.figureRow}>
        <View style={styles.figure}>
          <Skeleton width={Math.min(150, Math.max(0, innerWidth - 120))} height={36} radius={8} />
          <Skeleton width={Math.min(150, Math.max(0, innerWidth - 120))} height={11} radius={4} />
        </View>
        <Skeleton width={104} height={104} radius={52} />
      </View>
      <View style={styles.row}>
        <Skeleton width={Math.max(0, Math.min(150, innerWidth - 98))} height={26} radius={13} />
      </View>
      <Skeleton width={innerWidth} height={62} radius={18} />
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.action}>
            <Skeleton width={actionWidth} height={48} radius={18} />
          </View>
        ))}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, padding: 14, gap: 10 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  figureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  figure: { gap: 10 },
  action: { flex: 1, alignItems: 'center' },
});
