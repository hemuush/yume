import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Skeleton } from '@/components/Skeleton';

/**
 * Stands in for the whole Reports body while its first `getRangeComparison`
 * (etc.) batch is still in flight — chart-shaped areas (the heatmap, the
 * two bar charts) are one large skeleton block each rather than dozens of
 * individually-animated cells/bars: each `Skeleton` runs its own looping
 * animation, and a real calendar grid or bar chart would mean 20-30 of them
 * running at once for no real visual gain over a single block the same
 * size.
 */
export function ReportsSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.headlineRow}>
        <View>
          <Skeleton width={92} height={9} radius={4} />
          <Skeleton width={140} height={26} radius={6} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={64} height={28} radius={999} />
      </View>

      <Skeleton width={60} height={12} radius={4} style={{ marginTop: 28 }} />
      <Skeleton width={300} height={190} radius={16} style={{ marginTop: 10 }} />

      <View style={styles.rule} />

      <Skeleton width={132} height={132} circle radius={66} style={styles.centered} />

      <View style={styles.rule} />

      <Skeleton width={90} height={12} radius={4} />
      <View style={styles.catCard}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.catRow, i > 0 && styles.catRowDivider]}>
            <Skeleton width={8} height={8} circle radius={4} />
            <Skeleton width={110} height={10} radius={4} style={styles.catName} />
            <Skeleton width={50} height={10} radius={4} />
          </View>
        ))}
      </View>

      <View style={styles.rule} />

      <Skeleton width={180} height={12} radius={4} />
      <Skeleton width={300} height={90} radius={12} style={{ marginTop: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  centered: { alignSelf: 'center' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderSoft, marginVertical: 22 },
  catCard: {
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
    paddingHorizontal: 14,
  },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  catRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  catName: { flex: 1, marginLeft: 8, marginRight: 8 },
});
