import { View, Pressable } from 'react-native';
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
 * Thin rail under the period arrows: a segment per week, sized by its days (a 3-day first week looks short).
 * Shown week dark, today's week dotted, future weeks faint; tapping a segment jumps to that week.
 */
export function WeekRail({
  week,
  todayIso,
  onPickWeek,
}: {
  week: ActivityWeek;
  todayIso: string;
  onPickWeek: (start: string) => void;
}) {
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
    </View>
  );
}
