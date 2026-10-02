import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { visitsLine } from './visits';

export interface SplitItem {
  key: string;
  name: string;
  minor: number;
  /** How many entries; the visits line only shows past one. */
  count?: number;
  /** A grouped "rest" line says how often but has no usual amount. */
  visits?: string;
}

// Alpha steps of the category colour, strongest first, so the segments read as one family.
const TONES = ['FF', 'B3', '80', '59', '40'];
const tone = (color: string, i: number) => `${color}${TONES[Math.min(i, TONES.length - 1)]}`;

/** One stacked bar for the whole category and a legend row per place: share, then amount. */
export function SplitBreakdown({
  items,
  totalMinor,
  color,
}: {
  items: SplitItem[];
  totalMinor: number;
  color: string;
}) {
  return (
    <View>
      <View style={styles.stack}>
        {items.map((s, i) => (
          <View key={s.key} style={{ flex: Math.max(s.minor, 1), backgroundColor: tone(color, i) }} />
        ))}
      </View>
      <View style={styles.legend}>
        {items.map((s, i) => {
          const visits = s.visits ?? (s.count && s.count > 1 ? visitsLine(s.count, s.minor) : undefined);
          return (
            <View key={s.key} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: tone(color, i) }]} />
              <View style={styles.names}>
                <Text style={styles.name} numberOfLines={1}>
                  {s.name}
                </Text>
                {!!visits && <Text style={styles.visits}>{visits}</Text>}
              </View>
              <Text style={styles.share}>
                {totalMinor > 0 ? `${Math.round((s.minor / totalMinor) * 100)}%` : ''}
              </Text>
              <Text style={styles.amount}>{formatMoney(s.minor)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', height: 12, borderRadius: theme.radius.pill, overflow: 'hidden', gap: 2 },
  legend: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  names: { flex: 1, minWidth: 0 },
  name: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  visits: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 1 },
  share: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  amount: {
    fontFamily: theme.font.monoBold,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    minWidth: 62,
    textAlign: 'right',
  },
});
