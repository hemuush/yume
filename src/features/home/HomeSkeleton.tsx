import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { Glass } from '@/components/Glass';

export { CardRowsSkeleton } from '@/components/ListSkeleton';

/**
 * Stands in for `ThisMonthHero` on Home's first load, in the card's own shape (label and month pill, the big
 * figure, its chips, the three Add buttons), so nothing jumps when the real card replaces it.
 */
export function ThisMonthHeroSkeleton() {
  return (
    <Glass radius={28} style={styles.card}>
      <View style={styles.bar}>
        <Skeleton width={84} height={12} radius={4} />
        <Skeleton width={96} height={30} radius={15} />
      </View>
      <Skeleton width={170} height={40} radius={8} />
      <Skeleton width={190} height={11} radius={4} />
      <View style={styles.row}>
        <Skeleton width={90} height={26} radius={13} />
        <Skeleton width={150} height={26} radius={13} />
      </View>
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.action}>
            <Skeleton width={100} height={64} radius={18} />
          </View>
        ))}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, padding: 16, gap: 12 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center' },
});
