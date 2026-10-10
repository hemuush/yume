import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass, GLASS } from '@/components/Glass';
import { Kicker, FrostChip } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { longMonthYear } from '@/lib/dateLabels';
import { DEEP_STREAK, GardenMonth } from './gardenMonth';
import { showAlert } from '@/components/AppDialog';

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
                  {d.state !== 'future' && (
                    <Text style={styles.stateMark} accessible={false}>
                      {d.state === 'kept' ? '✓' : d.state === 'missed' ? '●' : '◌'}
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
      <View style={styles.legend}>
        <Text style={styles.legendText}>✓ Kept</Text>
        <Text style={styles.legendText}>● Over goal</Text>
        <Text style={styles.legendText}>◌ Untracked</Text>
        <Text style={styles.legendText}>Faded · Future</Text>
      </View>
      <Text style={styles.legendText}>Today’s result can change until the day ends.</Text>
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
    flexWrap: 'wrap',
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
  missed: { backgroundColor: theme.colors.expenseTint, borderColor: theme.colors.idCoral },
  untracked: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: theme.colors.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  faint: { opacity: 0.45 },
  today: { borderWidth: 2, borderColor: theme.colors.ink },
  day: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  stateMark: { fontFamily: theme.font.body, fontSize: 10, color: theme.colors.textPrimary },
  dayKept: { color: theme.colors.ink },
});
