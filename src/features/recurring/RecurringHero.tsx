import { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import { InsightDisclosure } from '@/components/InsightCard';
import { CountUpAmount } from '@/components/CountUpAmount';
import {
  SummaryCard,
  SummaryFacts,
  SummarySide,
  SummarySplit,
  SummaryTop,
  summaryFigure,
  summaryNote,
} from '@/components/SummaryCard';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { addDaysToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import type { SubscriptionTotals } from '@/db/subscriptions';
import { CostShare, RunMark, RUN_WINDOW_DAYS, topShareLine, groupRunMarks } from './recurring.helpers';

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
  onDatePress,
  currency,
  hasOtherCurrencies = false,
}: {
  totals: SubscriptionTotals;
  shares: CostShare[];
  /** The earliest next run among running rules. */
  nextDate: string | null;
  /** Runs in the next 30 days (see runMarks). */
  marks?: RunMark[];
  /** YYYY-MM-DD the line starts from. */
  today?: string;
  onDatePress?: (date: string) => void;
  currency?: string;
  hasOtherCurrencies?: boolean;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const [width, setWidth] = useState(0);
  const running = totals.count > 0;
  const start = today ? parseLocalIsoDate(today).getTime() : 0;
  const grouped = groupRunMarks(marks);
  const max = Math.max(1, ...grouped.map((m) => m.amountMinor));
  // Days from today along the line, 0 (today) to 1 (the window's last day).
  const xOf = (date: string) =>
    Math.round((parseLocalIsoDate(date).getTime() - start) / DAY_MS) / (RUN_WINDOW_DAYS - 1);
  const midDate = today ? addDaysToIsoDate(today, Math.round((RUN_WINDOW_DAYS - 1) / 2)) : null;
  const endDate = today ? addDaysToIsoDate(today, RUN_WINDOW_DAYS - 1) : null;

  const timelineShown = !!today && marks.length > 0;
  // The dates a run lands on; each jumps to its day. Inside the timeline when there is one.
  const chips =
    grouped.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.dateGroups}>
        {grouped.map((m) => (
          <Pressable
            key={m.date}
            style={styles.dateGroup}
            onPress={() => onDatePress?.(m.date)}
            disabled={!onDatePress}
            accessibilityRole="button"
            accessibilityLabel={`${weekdayDayMonth(m.date)}, ${m.count} ${m.count === 1 ? 'entry' : 'entries'}`}
          >
            <Text style={styles.dateText}>
              {dayMonth(m.date)} · {m.count} {m.count === 1 ? 'entry' : 'entries'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    ) : null;

  const schedule = (
    <>
      {today && marks.length > 0 && (
        <View style={styles.timeline}>
          <InsightDisclosure title="Next 30 days timeline">
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.lineLabel}>When they land, next 30 days</Text>
              <View
                testID="landLine"
                style={styles.line}
                onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
              >
                <View style={styles.rail} />
                {width > 0 &&
                  grouped.map((m) => {
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
            {chips}
          </InsightDisclosure>
        </View>
      )}
      {!timelineShown && chips}
    </>
  );

  const biggest = shares[0];
  return (
    // Keyed so it can't lose its children when it switches between the two states.
    <SummaryCard
      key={running ? 'totals' : 'intro'}
      style={timelineShown ? styles.cardWithDisclosure : undefined}
    >
      {running ? (
        <>
          <SummaryTop
            label="Subscriptions & bills"
            figure={
              <View style={styles.figureRow}>
                <CountUpAmount
                  minor={totals.monthlyMinor}
                  currency={currency}
                  countFromZero={false}
                  style={summaryFigure}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                />
                <Text style={styles.figureNote}>a month</Text>
              </View>
            }
            side={<SummarySide main={`${formatMoney(totals.yearlyMinor, currency)} a year`} />}
          />
          {shares.length > 1 && (
            <SummarySplit parts={shares.map((s) => ({ key: s.key, weight: s.minor, color: s.color }))} />
          )}
          <SummaryFacts
            facts={[
              { label: 'Running', value: String(totals.count) },
              ...(nextDate ? [{ label: 'Next due', value: weekdayDayMonth(nextDate) }] : []),
              ...(shares.length > 1 && biggest
                ? [{ label: 'Biggest', value: `${biggest.name} ${formatMoney(biggest.minor, currency)}` }]
                : []),
            ]}
          />
          {!!topShareLine(shares) && <Text style={styles.note}>{topShareLine(shares)}</Text>}
          {schedule}
        </>
      ) : (
        <>
          <Text style={styles.title}>Subscriptions & bills</Text>
          <Text style={styles.note}>
            {hasOtherCurrencies
              ? `No running expense rules in ${currency}.`
              : 'Set up rent, a subscription or your salary once. Due entries are added when you open Yume.'}
          </Text>
          {schedule}
        </>
      )}
      {hasOtherCurrencies && (
        <Text style={styles.note}>
          Summary and timeline in {currency}. Other currencies are listed below.
        </Text>
      )}
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  // The timeline disclosure row sits flush with the card's bottom edge.
  cardWithDisclosure: { paddingBottom: 4 },
  timeline: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  figureNote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  note: summaryNote,
  dateGroups: { gap: 6 },
  dateGroup: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  dateText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },
  lineLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  line: { height: LINE_HEIGHT, justifyContent: 'center' },
  rail: { height: 2, borderRadius: 1, backgroundColor: 'rgba(18,19,15,0.12)' },
  dot: { position: 'absolute', borderWidth: 3, backgroundColor: theme.colors.surface },
  axis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', marginTop: 2 },
  axisText: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
});
