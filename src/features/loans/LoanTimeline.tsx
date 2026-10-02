import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import { payoffMonthShort } from '@/lib/loanPayoff';
import type { Timeline } from './timelineLayout';

/** When each borrowed loan ends, on one shared axis from today to the last of them. */
export function LoanTimeline({ timeline, hues }: { timeline: Timeline; hues: Record<string, string> }) {
  return (
    <View>
      <Text style={styles.title}>Debt-free timeline</Text>
      <View style={styles.card}>
        {timeline.rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.name} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={styles.date}>{payoffMonthShort(row.endDate)}</Text>
            </View>
            <View style={styles.track}>
              <GrowFill
                animKey={`loan-timeline:${row.id}`}
                pct={row.fraction * 100}
                style={[styles.fill, { backgroundColor: shade(hues[row.id] ?? theme.colors.idGold, 72) }]}
              />
            </View>
          </View>
        ))}
        <View style={styles.axis}>
          <Text style={styles.axisText}>Now</Text>
          {timeline.midYear !== null && <Text style={styles.axisText}>{timeline.midYear}</Text>}
          <Text style={styles.axisText}>{timeline.endYear}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...SECTION_TITLE,
    marginHorizontal: 20,
    marginTop: SECTION_GAP.top - 12,
    marginBottom: SECTION_GAP.bottom,
  },
  card: {
    marginHorizontal: 20,
    padding: 16,
    gap: 12,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  row: { gap: 6 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary, flexShrink: 1 },
  date: { fontFamily: theme.font.mono, fontSize: 11, color: theme.colors.textMuted },
  track: { height: 10, borderRadius: 5, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontFamily: theme.font.mono, fontSize: 10.5, color: theme.colors.textMuted },
});
