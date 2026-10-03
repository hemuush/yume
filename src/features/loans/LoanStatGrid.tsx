import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { screenStyles as h } from '@/components/screenStyles';

export interface LoanStat {
  label: string;
  value: string;
  /** A line under the value: a date, a total. */
  sub?: string;
}

/** The loan's four headline facts as one card, two across. */
export function LoanStatGrid({ stats }: { stats: LoanStat[] }) {
  return (
    <View style={[h.card, h.cardInSheet, styles.grid]}>
      {stats.map((s) => (
        <View key={s.label} style={styles.cell}>
          <Text style={styles.label}>{s.label}</Text>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Text>
          {s.sub ? (
            <Text style={styles.sub} numberOfLines={1}>
              {s.sub}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, rowGap: 14 },
  cell: { width: '50%', paddingRight: 8 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  value: { fontFamily: theme.font.monoBold, fontSize: 16, color: theme.colors.textPrimary, marginTop: 2 },
  sub: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
});
