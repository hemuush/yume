import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { Glass, GLASS } from '@/components/Glass';
import { Kicker, FrostChip } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { longMonthYear } from '@/lib/dateLabels';
import { DEEP_STREAK, GardenMonth } from './gardenMonth';
import { showAlert } from '@/components/AppDialog';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The garden's month: every day as a small square, green with a tick when kept under the goal (deeper once a
 * streak passes a week), plain when over it, dashed before the first expense, faint when still to come, today
 * outlined. The seven columns share the card's width; at large text the tick goes rather than the grid scrolling.
 */
export function GardenMonthCard({ month, today }: { month: GardenMonth; today: string }) {
  const { fontScale } = useWindowDimensions();
  const showTick = fontScale <= 1.2;
  const cells: (GardenMonth['days'][number] | null)[] = [...Array(month.lead).fill(null), ...month.days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  return (
    <Glass radius={24} style={styles.card}>
      <View style={styles.head}>
        <Kicker icon="calendar">{longMonthYear(today)}</Kicker>
        {month.counted > 0 && (
          <FrostChip tone={month.kept > 0 ? 'ok' : undefined}>
            {month.kept} of {month.counted} kept
          </FrostChip>
        )}
      </View>
      <View style={styles.grid}>
        <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.row}>
            {week.map((d, i) =>
              d ? (
                <Pressable
                  key={d.date}
                  style={[
                    styles.cell,
                    d.state === 'kept' && (d.streakDays >= DEEP_STREAK ? styles.keptDeep : styles.kept),
                    d.state === 'missed' && styles.missed,
                    d.state === 'untracked' && styles.untracked,
                    d.state === 'future' && styles.faint,
                    d.today && styles.today,
                  ]}
                  accessible
                  accessibilityRole="button"
                  disabled={d.state === 'future'}
                  onPress={() =>
                    showAlert(
                      `${d.day} ${longMonthYear(today)}`,
                      `${d.state === 'kept' ? 'Kept under the daily goal.' : d.state === 'missed' ? 'Over the daily goal.' : 'No tracked spending yet.'}${d.today ? ' Today is still in progress; its result can change.' : ''}`
                    )
                  }
                  accessibilityLabel={`${d.day}${d.today ? ', today' : ''}: ${
                    d.state === 'kept'
                      ? 'kept under the goal'
                      : d.state === 'missed'
                        ? 'over the goal'
                        : d.state === 'future'
                          ? 'still to come'
                          : 'not tracked yet'
                  }`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={[styles.day, d.state === 'kept' && styles.dayKept]}>{d.day}</Text>
                    {d.state === 'kept' && showTick && (
                      <Text style={styles.stateMark} accessible={false}>
                        ✓
                      </Text>
                    )}
                  </View>
                </Pressable>
              ) : (
                <View key={`blank-${i}`} style={[styles.cell, styles.blank]} />
              )
            )}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.kept]} />
          <Text style={styles.legendText}>Kept</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.missed]} />
          <Text style={styles.legendText}>Over goal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.untracked, styles.swatchDashed]} />
          <Text style={styles.legendText}>Not tracked</Text>
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  grid: { gap: 4 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  row: { flexDirection: 'row', gap: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  cell: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 8,
    minWidth: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  blank: { backgroundColor: 'transparent', borderColor: 'transparent' },
  kept: { backgroundColor: '#B6E3C6', borderColor: '#B6E3C6' },
  keptDeep: { backgroundColor: '#6FC290', borderColor: '#6FC290' },
  missed: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.borderSoft },
  untracked: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: theme.colors.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1 },
  swatchDashed: { borderStyle: 'dashed' },
  legendText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  faint: { opacity: 0.45 },
  today: { borderWidth: 2, borderColor: theme.colors.ink },
  day: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  stateMark: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textPrimary },
  dayKept: { color: theme.colors.ink },
});
