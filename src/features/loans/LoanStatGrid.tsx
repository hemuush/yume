import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';

interface LoanStat {
  label: string;
  value: string;
  /** A line under the value: a date, a total. */
  sub?: string;
}

/** Headline facts in one card, side by side; they stack on narrow screens or with larger text. */
export function LoanStatGrid({ stats }: { stats: LoanStat[] }) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  return (
    <View style={[styles.card, stacked && styles.cardStacked]}>
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={[styles.cell, i > 0 && (stacked ? styles.dividerTop : styles.dividerLeft)]}
        >
          <Text style={styles.label}>{s.label}</Text>
          <Text style={styles.value}>{s.value}</Text>
          {s.sub ? <Text style={styles.sub}>{s.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 20,
    marginBottom: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  cardStacked: { flexDirection: 'column' },
  cell: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 10 },
  dividerLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.divider },
  dividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  value: {
    fontFamily: theme.font.bodyMedium,
    fontVariant: ['tabular-nums'],
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
});
