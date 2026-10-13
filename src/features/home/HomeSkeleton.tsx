import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';

export { CardRowsSkeleton } from '@/components/ListSkeleton';

/**
 * Stands in for `ThisMonthHero` on Home's first load, in the card's own shape (label and month pill, the big
 * figure, its chips, the three Add buttons), so nothing jumps when the real card replaces it.
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
      <Skeleton width={Math.min(170, innerWidth)} height={36} radius={8} />
      <Skeleton width={Math.min(190, innerWidth)} height={11} radius={4} />
      <View style={styles.row}>
        <Skeleton width={90} height={26} radius={13} />
        <Skeleton width={Math.max(0, Math.min(150, innerWidth - 98))} height={26} radius={13} />
      </View>
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
  action: { flex: 1, alignItems: 'center' },
});
