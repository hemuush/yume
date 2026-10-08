import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Skeleton } from '@/components/Skeleton';

/**
 * Stands in for the Reports body while the first `getRangeComparison` batch is in flight. Chart areas are one
 * large Skeleton block each: every Skeleton loops its own animation, so 20-30 cells/bars would be wasteful.
 */
export function ReportsSkeleton() {
  return (
    <View style={styles.wrap}>
      {/* The summary card's shape: label, total and badge, then its three day figures. */}
      <View style={styles.summary}>
        <View style={styles.headlineRow}>
          <View>
            <Skeleton width={110} height={11} radius={4} />
            <Skeleton width={160} height={30} radius={6} style={{ marginTop: 8 }} />
          </View>
          <Skeleton width={120} height={30} radius={999} />
        </View>
        <View style={styles.cells}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.cell}>
              <Skeleton width={56} height={9} radius={3} />
              <Skeleton width={64} height={13} radius={4} style={{ marginTop: 7 }} />
            </View>
          ))}
        </View>
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
  summary: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  headlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cells: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  cell: { flex: 1 },
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
