import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Skeleton } from '@/components/Skeleton';

const BAR_HEIGHTS = [18, 34, 12, 44, 26, 38, 20];

/** Stands in for the headline + spend chart + day list while the first `listTransactions` batch is still loading. */
export function TransactionsSkeleton() {
  return (
    <View style={styles.wrap}>
      <Skeleton width={140} height={30} radius={6} />
      <Skeleton width={190} height={11} radius={4} style={{ marginTop: 8 }} />

      <View style={styles.barRow}>
        {BAR_HEIGHTS.map((h, i) => (
          <Skeleton key={i} width={20} height={h} radius={4} />
        ))}
      </View>

      {[0, 1].map((g) => (
        <View key={g} style={styles.dayGroup}>
          <Skeleton width={90} height={11} radius={4} />
          <View style={styles.dayCard}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Skeleton width={30} height={30} circle radius={15} />
                <View style={styles.rowMid}>
                  <Skeleton width={130} height={11} radius={4} />
                  <Skeleton width={80} height={8} radius={3} style={{ marginTop: 5 }} />
                </View>
                <Skeleton width={54} height={11} radius={4} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 56, marginTop: 24 },
  dayGroup: { marginTop: 26 },
  dayCard: {
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  rowMid: { flex: 1 },
});
