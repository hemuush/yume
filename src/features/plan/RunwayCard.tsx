import { useState } from 'react';
import { View, Pressable, LayoutChangeEvent } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ForecastDetails } from './ForecastDetails';
import { withPressed } from '@/lib/pressed';
import { PrimaryButton } from '@/components/PrimaryButton';
import Svg, { Path, Line } from 'react-native-svg';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { useAccent } from '@/theme/AccentContext';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { homeInk } from '@/features/home/homeInk';
import { DueSoon } from './planOverview';
import { Runway, RunwayDay } from './runway';
import { Kicker } from './PlanTiles';
import { styles, RUNWAY_HEIGHT } from './plan.styles';

/** Room above the line's highest point and below its lowest, inside the drawing. */
const PAD_TOP = 18;
const PAD_BOTTOM = 10;
const PIN = 12;

/**
 * Spending balance, scoped inflow/outflow and a compact forecast verdict. Upcoming adds the
 * scheduled-balance line with markers on each day's closing balance. Without an account,
 * show scheduled outgoing and account setup instead of implying a balance.
 */
export function RunwayCard({
  dueSoon,
  runway,
  hasAccounts,
  days,
  showChart,
  onAddAccount,
  nextPayment,
  onUpcoming,
}: {
  dueSoon: DueSoon;
  runway: Runway;
  /** Whether any bank, cash or wallet account holds the balance the line starts from. */
  hasAccounts: boolean;
  /** The window the runway covers. */
  days: number;
  /** Draw the balance line under the sentence (the Upcoming tab). */
  showChart?: boolean;
  onAddAccount?: () => void;
  nextPayment?: { date: string; title: string } | null;
  onUpcoming?: () => void;
}) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const [width, setWidth] = useState(0);
  const [details, setDetails] = useState(false);
  const outgoingMinor = hasAccounts
    ? runway.days.reduce((total, day) => total + day.outMinor, 0)
    : dueSoon.totalMinor;
  const none = outgoingMinor === 0;
  const hasChanges = runway.days.some((d) => d.afterMinor !== d.beforeMinor);
  const last = runway.days[runway.days.length - 1];

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const values = [runway.startMinor, ...runway.days.map((d) => d.afterMinor)];
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const count = runway.days.length;
  const x = (i: number) => (count > 1 ? (i / (count - 1)) * width : 0);
  const y = (v: number) => PAD_TOP + ((max - v) / span) * (RUNWAY_HEIGHT - PAD_TOP - PAD_BOTTOM);

  let line = `M0,${y(runway.startMinor)}`;
  runway.days.forEach((d, i) => {
    if (d.afterMinor !== d.beforeMinor) line += ` H${x(i)} V${y(d.afterMinor)}`;
  });
  line += ` H${width}`;

  const pinColor = (d: RunwayDay) =>
    d.items.some((i) => i.kind === 'emi')
      ? ink
      : d.outMinor > 0
        ? theme.colors.slice.due
        : theme.colors.income;

  const payments = `${dueSoon.count} payment${dueSoon.count === 1 ? '' : 's'}`;
  const comingIn = runway.inMinor > 0 ? ` · +${formatMoney(runway.inMinor)} coming in` : '';
  let figure: string;
  let note: string;
  if (!hasAccounts) {
    figure = none ? 'Nothing due' : formatMoney(outgoingMinor);
    note = none
      ? 'Add a bank, cash or wallet account to see your balance.'
      : `going out · ${payments}. Add a bank, cash or wallet account to see your balance.`;
  } else if (none) {
    figure = formatMoney(runway.startMinor);
    note = `No payments in the next ${days} days${comingIn}`;
  } else if (runway.short) {
    figure = formatMoney(runway.startMinor);
    note = `${formatMoney(outgoingMinor)} going out · short ${formatMoney(runway.short.minor)} on ${weekdayDayMonth(runway.short.date)}${comingIn}`;
  } else {
    figure = formatMoney(runway.startMinor);
    note = `${formatMoney(outgoingMinor)} going out · ${payments}. Ends at ${formatMoney(runway.endMinor)}, lowest ${formatMoney(runway.lowMinor)} on ${dayMonth(runway.lowDate)}${comingIn}`;
  }

  return (
    <>
      <Glass radius={28} tone="strong" style={[styles.card, styles.cardFirst, cardSurface.summary]}>
        <Kicker icon="calendar">Next {days} days</Kicker>
        <View style={styles.forecastFigure}>
          <Text style={styles.forecastFact}>{hasAccounts ? 'Spending accounts' : 'Scheduled outgoing'}</Text>
          <Text style={styles.forecastValue}>{figure}</Text>
        </View>
        <View style={styles.forecastFacts}>
          <View style={styles.forecastMetric}>
            <Text style={styles.forecastFact}>Going out</Text>
            <Text style={styles.forecastMetricValue}>{formatMoney(outgoingMinor)}</Text>
          </View>
          <View style={styles.forecastMetric}>
            <Text style={styles.forecastFact}>Coming in</Text>
            <Text style={styles.forecastMetricValue}>{formatMoney(runway.inMinor)}</Text>
          </View>
        </View>
        {hasAccounts ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Forecast details. ${note}`}
            onPress={() => setDetails(true)}
            style={withPressed([styles.forecastAttention, runway.short && styles.forecastWarning])}
          >
            <View style={[styles.forecastStatusIcon, runway.short && styles.forecastStatusWarning]}>
              <Feather
                name={runway.short ? 'alert-circle' : 'check-circle'}
                size={19}
                color={runway.short ? theme.colors.expenseText : theme.colors.incomeText}
              />
            </View>
            <View style={styles.forecastAttentionCopy}>
              <Text style={[styles.forecastStatusTitle, runway.short && { color: theme.colors.expenseText }]}>
                {none
                  ? 'Nothing due'
                  : runway.short
                    ? `${formatMoney(runway.short.minor)} more needed`
                    : 'Covered'}
              </Text>
              <Text style={styles.forecastFact}>
                {none
                  ? note
                  : runway.short
                    ? `First shortfall · ${dayMonth(runway.short.date)}`
                    : `Lowest ${formatMoney(runway.lowMinor)} on ${dayMonth(runway.lowDate)}`}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={styles.bigNote}>{note}</Text>
            {onAddAccount && (
              <PrimaryButton title="Add account" variant="secondary" compact onPress={onAddAccount} />
            )}
          </View>
        )}

        {nextPayment && onUpcoming && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next payment ${dayMonth(nextPayment.date)}, ${nextPayment.title}. Open Upcoming`}
            onPress={onUpcoming}
            style={withPressed(styles.forecastNext)}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={styles.forecastFact}>
                {payments} in the next {days} days
              </Text>
              <Text style={styles.bigNote}>
                Next · {dayMonth(nextPayment.date)} · {nextPayment.title}
              </Text>
            </View>
            <Feather name="arrow-right" size={16} color={theme.colors.link} />
          </Pressable>
        )}

        {showChart && hasAccounts && hasChanges && (
          <View style={styles.forecastChart}>
            <View style={styles.forecastChartHeading}>
              <Text style={styles.forecastChartTitle}>Scheduled balance</Text>
              <Text style={styles.forecastFact}>Next {days} days</Text>
            </View>
            <View style={styles.runway} onLayout={onLayout} testID="runway">
              {width > 0 && (
                <Svg width={width} height={RUNWAY_HEIGHT}>
                  {min < 0 && (
                    <Line
                      x1={0}
                      x2={width}
                      y1={y(0)}
                      y2={y(0)}
                      stroke={theme.colors.expense}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  )}
                  <Path d={line} fill="none" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
                </Svg>
              )}
              {width > 0 &&
                runway.days.map((d, i) => {
                  if (d.items.length === 0) return null;
                  return (
                    <View
                      key={d.date}
                      pointerEvents="none"
                      style={[
                        styles.pin,
                        {
                          left: Math.max(0, Math.min(width - PIN, x(i) - PIN / 2)),
                          top: y(d.afterMinor) - PIN / 2,
                        },
                      ]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <View style={[styles.pinDot, { borderColor: pinColor(d) }]} />
                    </View>
                  );
                })}
            </View>
            <View
              style={styles.runwayAxis}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={styles.runwayAxisText}>Today</Text>
              <Text style={styles.runwayAxisText}>
                {dayMonth(runway.days[Math.floor(count / 2)]?.date ?? last.date)}
              </Text>
              <Text style={styles.runwayAxisText}>{dayMonth(last.date)}</Text>
            </View>
            <Text style={styles.forecastFact}>
              {min < 0 ? 'Dashed line: zero balance · ' : ''}Ends at {formatMoney(runway.endMinor)}
            </Text>
          </View>
        )}
      </Glass>
      {details && hasAccounts && <ForecastDetails runway={runway} onClose={() => setDetails(false)} />}
    </>
  );
}
