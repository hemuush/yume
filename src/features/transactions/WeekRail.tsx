import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { addDaysToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { withPressed } from '@/lib/pressed';
import { styles } from './transactions.styles';
import type { ActivityWeek } from './transactions.helpers';

/** Days a week covers, both ends included. */
function dayCount(w: { start: string; end: string }): number {
  let n = 1;
  for (let d = w.start; d < w.end; d = addDaysToIsoDate(d, 1)) n++;
  return n;
}

/**
 * A thin rail under the period arrows: one segment per week of the month,
 * sized by how many days it holds (so a 3-day first week looks short). The
 * week on screen is dark, today's week carries a dot, and weeks that haven't
 * started are faint. Tapping a segment jumps to that week.
 */
export function WeekRail({
  week,
  monthLabel,
  todayIso,
  onPickWeek,
}: {
  week: ActivityWeek;
  monthLabel: string;
  todayIso: string;
  onPickWeek: (start: string) => void;
}) {
  const days = dayCount(week);
  const caption = `Week ${week.index + 1} of ${week.ranges.length} · ${days} ${days === 1 ? 'day' : 'days'}`;
  return (
    <View style={styles.weekRail}>
      <View style={styles.weekRailBar}>
        {week.ranges.map((r, i) => {
          const selected = i === week.index;
          const future = r.start > todayIso;
          const now = todayIso >= r.start && todayIso <= r.end;
          return (
            <Pressable
              key={r.start}
              onPress={() => onPickWeek(r.start)}
              disabled={future}
              hitSlop={{ top: 8, bottom: 8 }}
              style={withPressed([styles.weekRailSeg, { flex: dayCount(r) }])}
              accessibilityRole="button"
              accessibilityLabel={`Week ${i + 1} of ${week.ranges.length}, ${parseLocalIsoDate(r.start).getDate()} to ${parseLocalIsoDate(r.end).getDate()}${now ? ', this week' : ''}`}
              accessibilityState={{ selected, disabled: future }}
            >
              <View
                style={[
                  styles.weekRailFill,
                  selected && { backgroundColor: theme.colors.ink },
                  future && { opacity: 0.5 },
                ]}
              />
              {now && <View style={styles.weekRailNow} />}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.weekRailCaption}>
        <Text style={styles.weekRailText}>{monthLabel}</Text>
        <Text style={[styles.weekRailText, styles.weekRailTextOn]}>{caption}</Text>
      </View>
    </View>
  );
}
