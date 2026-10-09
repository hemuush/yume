import { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { Kicker, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { addDaysToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from '@/features/home/homeInk';
import type { SubscriptionTotals } from '@/db/subscriptions';
import { CostShare, RunMark, RUN_WINDOW_DAYS, topShareLine } from './recurring.helpers';

const DAY_MS = 86400000;
/** A run's dot grows with its amount, between these sizes. */
const DOT_MIN = 10;
const DOT_MAX = 22;
const LINE_HEIGHT = 34;

/**
 * The top of Recurring: what running expense rules cost a month and a year, then a line of the next 30 days
 * with a dot on each day something lands (bigger dot, bigger amount; green for money in), the cost split, and
 * when the next is due. With none running, just a line on what the page does.
 */
export function RecurringHero({
  totals,
  shares,
  nextDate,
  marks = [],
  today,
}: {
  totals: SubscriptionTotals;
  shares: CostShare[];
  /** The earliest next run among running rules. */
  nextDate: string | null;
  /** Runs in the next 30 days (see runMarks). */
  marks?: RunMark[];
  /** YYYY-MM-DD the line starts from. */
  today?: string;
}) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const [width, setWidth] = useState(0);
  const running = totals.count > 0;
  const caption = [
    topShareLine(shares),
    `${totals.count} running`,
    nextDate ? `Next: ${weekdayDayMonth(nextDate)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const start = today ? parseLocalIsoDate(today).getTime() : 0;
  const max = Math.max(1, ...marks.map((m) => m.amountMinor));
  // Days from today along the line, 0 (today) to 1 (the window's last day).
  const xOf = (date: string) =>
    Math.round((parseLocalIsoDate(date).getTime() - start) / DAY_MS) / (RUN_WINDOW_DAYS - 1);
  const midDate = today ? addDaysToIsoDate(today, Math.round((RUN_WINDOW_DAYS - 1) / 2)) : null;
  const endDate = today ? addDaysToIsoDate(today, RUN_WINDOW_DAYS - 1) : null;

  return (
    // Keyed so it can't lose its children when it switches between the two states.
    <Glass key={running ? 'totals' : 'intro'} radius={28} tone="strong" style={styles.card}>
      {running ? (
        <>
          <View style={frost.heroRow}>
            <View style={frost.heroMain}>
              <Kicker icon="repeat">Subscriptions & bills</Kicker>
              <View style={frost.bigRow}>
                <Text style={frost.bigValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(totals.monthlyMinor)}
                </Text>
                <Text style={frost.bigNote}>a month</Text>
              </View>
            </View>
            <View style={frost.side}>
              <Text style={frost.sideLabel}>A year</Text>
              <Text style={frost.sideValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(totals.yearlyMinor)}
              </Text>
            </View>
          </View>

          {today && marks.length > 0 && (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.lineLabel}>When they land, next 30 days</Text>
              <View
                testID="landLine"
                style={styles.line}
                onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
              >
                <View style={styles.rail} />
                {width > 0 &&
                  marks.map((m) => {
                    const size = Math.round(DOT_MIN + Math.sqrt(m.amountMinor / max) * (DOT_MAX - DOT_MIN));
                    const x = Math.min(1, Math.max(0, xOf(m.date))) * width;
                    return (
                      <View
                        key={m.key}
                        style={[
                          styles.dot,
                          {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            left: Math.min(width - size, Math.max(0, x - size / 2)),
                            top: (LINE_HEIGHT - size) / 2,
                            borderColor: m.incoming ? theme.colors.income : ink,
                          },
                        ]}
                      />
                    );
                  })}
              </View>
              <View style={styles.axis}>
                <Text style={styles.axisText}>Today</Text>
                {midDate && <Text style={styles.axisText}>{dayMonth(midDate)}</Text>}
                {endDate && <Text style={styles.axisText}>{dayMonth(endDate)}</Text>}
              </View>
            </View>
          )}

          {shares.length > 1 && (
            <View style={styles.stack}>
              {shares.map((s) => (
                <View key={s.key} style={{ flex: s.minor, backgroundColor: s.color }} />
              ))}
            </View>
          )}
          <Text style={frost.sub}>{caption}</Text>
        </>
      ) : (
        <>
          <Kicker icon="repeat">Subscriptions & bills</Kicker>
          <Text style={frost.sub}>
            Set up rent, a subscription or your salary once, and Yume logs it on schedule, like any entry you
            typed yourself.
          </Text>
        </>
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  lineLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  line: { height: LINE_HEIGHT, justifyContent: 'center' },
  rail: { height: 2, borderRadius: 1, backgroundColor: 'rgba(18,19,15,0.12)' },
  dot: { position: 'absolute', borderWidth: 3, backgroundColor: theme.colors.surface },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisText: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  stack: {
    flexDirection: 'row',
    height: 10,
    gap: 2,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
});
