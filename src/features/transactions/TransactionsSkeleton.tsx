import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Skeleton } from '@/components/Skeleton';

const BAR_HEIGHTS = [18, 34, 12, 44, 26, 38, 20];

/**
 * Stands in for the headline + spend chart + day list while the first `listTransactions` batch is still
 * loading.
 */
export function TransactionsSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.sumCard}>
        <Skeleton width={120} height={13} radius={4} />
        <Skeleton width={150} height={34} radius={6} style={{ marginTop: 14 }} />
        <Skeleton width={190} height={22} radius={11} style={{ marginTop: 10 }} />
        <View style={styles.barRow}>
          {BAR_HEIGHTS.map((h, i) => (
            <Skeleton key={i} width={24} height={h} radius={7} />
          ))}
        </View>
      </View>

      {[0, 1].map((g) => (
        <View key={g} style={styles.dayGroup}>
          <Skeleton width={90} height={11} radius={4} />
          <View style={styles.dayCard}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Skeleton width={40} height={40} radius={13} />
                <View style={styles.rowMid}>
                  <Skeleton width={130} height={13} radius={4} />
                  <Skeleton width={90} height={10} radius={3} style={{ marginTop: 6 }} />
                </View>
                <Skeleton width={60} height={13} radius={4} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 6 },
  sumCard: {
    padding: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 76,
    marginTop: 24,
  },
  dayGroup: { marginTop: 26 },
  dayCard: {
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  rowDivider: { borderTopWidth: 1, borderTopColor: theme.colors.divider },
  rowMid: { flex: 1 },
});
