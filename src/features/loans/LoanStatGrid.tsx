import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';

export interface LoanStat {
  label: string;
  value: string;
  /** A line under the value: a date, a total. */
  sub?: string;
}

/** Headline facts in readable tiles that stack on narrow screens or with larger text. */
export function LoanStatGrid({ stats }: { stats: LoanStat[] }) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  return (
    <View style={styles.grid}>
      {stats.map((s) => (
        <View key={s.label} style={[styles.cell, stacked && styles.cellStacked]}>
          <Text style={styles.label}>{s.label}</Text>
          <Text style={styles.value}>{s.value}</Text>
          {s.sub ? <Text style={styles.sub}>{s.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cell: {
    flexBasis: '45%',
    flexGrow: 1,
    minWidth: 0,
    padding: 12,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  cellStacked: { flexBasis: '100%' },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  value: {
    fontFamily: theme.font.bodyBold,
    fontVariant: ['tabular-nums'],
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
});
