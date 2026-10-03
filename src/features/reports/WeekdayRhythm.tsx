import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { useAccent } from '@/theme/AccentContext';
import { theme } from '@/constants/theme';
import { formatMoney, toMajor } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { WeekdayRhythm as Rhythm, weekdayReadLine, WEEKDAY_MIN_DAYS } from './reportsInsights';
import { styles } from './reports.styles';

const BAR_MAX_HEIGHT = 80;
const BAR_MIN_HEIGHT = 6;
/** Distance from the chart's bottom to the bars' baseline: the weekday letter plus the gap above it. */
const BASELINE = 18;
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const barLabel = (minor: number) => Math.round(toMajor(minor)).toLocaleString();

/**
 * Average spend per weekday so far (Sunday first) against a dashed usual-day line; the busiest weekday is
 * full accent, tap a bar to read it. With too few days for a pattern, a slim note replaces the seven bars.
 */
export function WeekdayRhythm({
  rhythm,
  scopeName,
}: {
  rhythm: Rhythm | null;
  /** The category the heatmap is narrowed to; the bars follow it. */
  scopeName?: string;
}) {
  const { accent } = useAccent();
  const [picked, setPicked] = useState<number | null>(null);

  if (rhythm === null) {
    return (
      <View style={styles.rhythmBlock}>
        <Text style={styles.blockTitle}>Weekday rhythm</Text>
        <View style={styles.rhythmCard}>
          <Text style={styles.rhythmEmpty}>
            Needs about {WEEKDAY_MIN_DAYS / 7} weeks of entries before a weekday pattern means anything.
          </Text>
        </View>
      </View>
    );
  }

  const selected = picked ?? rhythm.peak;
  const max = Math.max(1, ...rhythm.avgMinor);
  const weeks = Math.floor(rhythm.countedDays / 7);
  return (
    <View style={styles.rhythmBlock}>
      <View style={styles.storyHead}>
        <Text style={styles.blockTitle}>Weekday rhythm</Text>
        <Text style={styles.storyPos}>
          {scopeName ? `${scopeName} · ` : ''}
          {weeks} {weeks === 1 ? 'week' : 'weeks'}
        </Text>
      </View>
      <View style={styles.rhythmCard}>
        <View style={styles.rhythmChart}>
          <View
            pointerEvents="none"
            style={[styles.rhythmUsual, { bottom: BASELINE + (rhythm.usualMinor / max) * BAR_MAX_HEIGHT }]}
          >
            <Text style={styles.rhythmUsualTag}>usual {formatMoney(rhythm.usualMinor)}</Text>
          </View>
          {rhythm.avgMinor.map((avg, i) => {
            const on = i === selected;
            const shows = on || i === rhythm.peak;
            return (
              <Pressable
                key={i}
                onPress={() => setPicked(i)}
                style={withPressed(styles.rhythmBar)}
                accessibilityRole="button"
                accessibilityLabel={`${NAMES[i]}, ${formatMoney(avg)} a day on average`}
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.rhythmValue, on && styles.rhythmValueOn]} numberOfLines={1}>
                  {shows ? barLabel(avg) : ''}
                </Text>
                <View
                  style={[
                    styles.rhythmFill,
                    {
                      height: Math.max(BAR_MIN_HEIGHT, (avg / max) * BAR_MAX_HEIGHT),
                      backgroundColor: i === rhythm.peak || on ? accent : accent + '6B',
                      borderWidth: on ? 2 : 0,
                      borderColor: theme.colors.ink,
                    },
                  ]}
                />
                <Text style={[styles.rhythmLabel, on && styles.rhythmLabelOn]}>{LETTERS[i]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.rhythmRead}>{weekdayReadLine(rhythm, selected)}</Text>
      </View>
    </View>
  );
}
