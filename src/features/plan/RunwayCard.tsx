import { useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { compactMoney } from '@/lib/compactMoney';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { homeInk } from '@/features/home/homeInk';
import { DueSoon } from './planOverview';
import { Runway, RunwayDay } from './runway';
import { Kicker } from './PlanTiles';
import { styles, RUNWAY_HEIGHT } from './plan.styles';

/** Room above the line's highest point and below its lowest, inside the drawing. */
const PAD_TOP = 18;
const PAD_BOTTOM = 10;
const PIN = 44;

/**
 * The Plan hero, verdict first: whether your spending accounts cover the next 14 days of EMIs and bills, in
 * one headline ("Short ₹6,619", "Covered", "Nothing due") with a single grey line under it, then the balance
 * walk as a line with a pin per payment day. The Coming up list is drawn under it, inside the same card.
 * Without a spending account there's no balance to draw, so it says what is going out instead.
 */
export function RunwayCard({
  dueSoon,
  runway,
  hasAccounts,
  children,
}: {
  dueSoon: DueSoon;
  runway: Runway;
  /** Whether any bank, cash or wallet account holds the balance the line starts from. */
  hasAccounts: boolean;
  /** The Coming up list, drawn under the verdict inside the same card. */
  children?: React.ReactNode;
}) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const [width, setWidth] = useState(0);
  const none = dueSoon.count === 0;
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
  const area = `${line} V${RUNWAY_HEIGHT} H0 Z`;
  const lowIndex = runway.days.findIndex((d) => d.date === runway.lowDate);

  const pinColor = (d: RunwayDay) =>
    d.items.some((i) => i.kind === 'emi')
      ? ink
      : d.outMinor > 0
        ? theme.colors.slice.due
        : theme.colors.income;

  const payments = `${dueSoon.count} payment${dueSoon.count === 1 ? '' : 's'}`;
  const comingIn = runway.inMinor > 0 ? ` · +${formatMoney(runway.inMinor)} coming in` : '';
  let headline: string;
  let note: string;
  if (!hasAccounts) {
    headline = none ? 'Nothing due' : formatMoney(dueSoon.totalMinor);
    note = none
      ? 'Add a bank, cash or wallet account to see your balance.'
      : `going out · ${payments}. Add a bank, cash or wallet account to see your balance.`;
  } else if (none) {
    headline = 'Nothing due';
    note = `Your spending accounts hold ${formatMoney(runway.startMinor)}${comingIn}`;
  } else if (runway.short) {
    headline = `Short ${formatMoney(runway.short.minor)}`;
    note = `on ${weekdayDayMonth(runway.short.date)} · ${formatMoney(dueSoon.totalMinor)} going out, you hold ${formatMoney(runway.startMinor)}${comingIn}`;
  } else {
    headline = 'Covered';
    note = `${formatMoney(dueSoon.totalMinor)} going out · ${payments}. Ends at ${formatMoney(runway.endMinor)}, lowest ${formatMoney(runway.lowMinor)} on ${dayMonth(runway.lowDate)}${comingIn}`;
  }

  return (
    <Glass
      radius={28}
      tone="strong"
      style={[
        styles.card,
        styles.cardFirst,
        cardSurface.summary,
        !none && cardSurface.payments,
        runway.short && cardSurface.warning,
      ]}
    >
      <Kicker icon="calendar">Next 14 days</Kicker>
      <View style={styles.forecastFigure}>
        <Text
          style={[styles.forecastValue, !!runway.short && hasAccounts && { color: theme.colors.expenseText }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {headline}
        </Text>
        <Text style={styles.bigNote}>{note}</Text>
      </View>

      {hasAccounts && hasChanges && (
        <View>
          <View style={styles.runway} onLayout={onLayout} testID="runway">
            {width > 0 && (
              <Svg width={width} height={RUNWAY_HEIGHT}>
                <Defs>
                  <LinearGradient id="runwayArea" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={shade(accent, 70)} stopOpacity={0.5} />
                    <Stop offset="1" stopColor={shade(accent, 70)} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Path d={area} fill="url(#runwayArea)" />
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
            {width > 0 && !runway.short && !none && lowIndex >= 0 && (
              <Text
                style={[
                  styles.runwayLow,
                  {
                    left: Math.max(0, Math.min(x(lowIndex) - 20, width - 64)),
                    top: Math.min(y(runway.lowMinor) + 6, RUNWAY_HEIGHT - 14),
                  },
                ]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                low {compactMoney(runway.lowMinor)}
              </Text>
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
                        left: x(i) - PIN / 2,
                        top: Math.max(
                          0,
                          Math.min(RUNWAY_HEIGHT - PIN, (y(d.beforeMinor) + y(d.afterMinor)) / 2 - PIN / 2)
                        ),
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
        </View>
      )}
      {children}
    </Glass>
  );
}
