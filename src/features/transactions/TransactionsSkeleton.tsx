import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Skeleton } from '@/components/Skeleton';

const BAR_HEIGHTS = [12, 24, 8, 32, 18, 26, 14];

/**
 * Stands in for the headline + spend chart + day list while the first `listTransactions` batch is still
 * loading.
 */
export function TransactionsSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.sumCard}>
        <Skeleton width={120} height={12} radius={4} />
        <Skeleton width={110} height={26} radius={6} style={{ marginTop: 2 }} />
        <Skeleton width={170} height={12} radius={4} style={{ marginTop: 6 }} />
        <View style={styles.barRow}>
          {BAR_HEIGHTS.map((h, i) => (
            <Skeleton key={i} width={18} height={h} radius={6} />
          ))}
        </View>
      </View>

      {[0, 1].map((g) => (
        <View key={g} style={styles.dayGroup}>
          <Skeleton width={90} height={11} radius={4} />
          <View style={styles.dayCard}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Skeleton width={32} height={32} radius={16} />
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
  wrap: { paddingHorizontal: 16, paddingTop: 6 },
  sumCard: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 48,
    marginTop: 20,
  },
  dayGroup: { marginTop: 16 },
  dayCard: {
    marginTop: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: theme.colors.divider },
  rowMid: { flex: 1 },
});
