import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass, GLASS } from '@/components/Glass';
import { Kicker, FrostChip } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { longMonthYear } from '@/lib/dateLabels';
import { DEEP_STREAK, GardenMonth } from './gardenMonth';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The garden's month: every day as a small square, green when kept under the goal (deeper once a streak
 * passes a week), clear when missed, faint before the first expense or still to come, today outlined.
 */
export function GardenMonthCard({ month, today }: { month: GardenMonth; today: string }) {
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
              <View
                key={d.date}
                style={[
                  styles.cell,
                  d.state === 'kept' && (d.streakDays >= DEEP_STREAK ? styles.keptDeep : styles.kept),
                  (d.state === 'future' || d.state === 'untracked') && styles.faint,
                  d.today && styles.today,
                ]}
                accessible
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
                <Text style={[styles.day, d.state === 'kept' && styles.dayKept]}>{d.day}</Text>
              </View>
            ) : (
              <View key={`blank-${i}`} style={[styles.cell, styles.blank]} />
            )
          )}
        </View>
      ))}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 16, padding: 14, gap: 6 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', gap: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 10.5,
    color: theme.colors.textMuted,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
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
  faint: { opacity: 0.45 },
  today: { borderWidth: 2, borderColor: theme.colors.ink },
  day: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textSecondary },
  dayKept: { color: theme.colors.ink },
});
