import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Skeleton } from './Skeleton';

/** One skeleton row inside a list-shaped card — `subtitle` adds a second, shorter line under the title (an Upcoming/Recent-activity row); `meter` adds the thin progress-bar-shaped line a Budget row has underneath. */
function RowSkeleton({
  subtitle,
  meter,
  divider,
}: {
  subtitle?: boolean;
  meter?: boolean;
  divider?: boolean;
}) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <Skeleton width={subtitle ? 26 : 24} height={subtitle ? 26 : 24} circle radius={subtitle ? 13 : 8} />
      <View style={styles.rowMid}>
        <Skeleton width={subtitle ? 130 : 110} height={11} radius={4} />
        {subtitle && <Skeleton width={70} height={8} radius={3} style={{ marginTop: 4 }} />}
        {meter && <Skeleton width={200} height={5} radius={3} style={{ marginTop: 6 }} />}
      </View>
      <Skeleton width={48} height={11} radius={4} />
    </View>
  );
}

/**
 * A list-shaped card, `rows` skeleton rows deep, matching the bordered list cards shared by Home sections and
 * other screens (Budgets, Loans, ...), so it reads as "this kind of list is loading" everywhere.
 */
export function CardRowsSkeleton({
  rows = 2,
  subtitle,
  meter,
}: {
  rows?: number;
  subtitle?: boolean;
  meter?: boolean;
}) {
  return (
    <View style={styles.card}>
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} subtitle={subtitle} meter={meter} divider={i > 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  rowMid: { flex: 1 },
});
