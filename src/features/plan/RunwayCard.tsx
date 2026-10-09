import { useState } from 'react';
import { View, Pressable, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { compactMoney } from '@/lib/compactMoney';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { dueDateLabel } from '@/lib/dueDate';
import { homeInk } from '@/features/home/homeInk';
import { DueGroup, DueSoon } from './planOverview';
import { Runway, RunwayDay } from './runway';
import { Kicker, PlanChip } from './PlanTiles';
import { styles, RUNWAY_HEIGHT } from './plan.styles';

/** Room above the line's highest point and below its lowest, inside the drawing. */
const PAD_TOP = 18;
const PAD_BOTTOM = 10;
const PIN = 32;

/**
 * The Plan hero: what's going out in the next 14 days, and a line of what your spending accounts hold as each
 * EMI and bill comes out (and income comes in), so it answers "can I cover it?". Each payment day is a pin:
 * tap one for that day, then jump to it in Coming up. Without a spending account there's no balance to draw,
 * so it says what's next instead.
 */
export function RunwayCard({
  dueSoon,
  runway,
  hasAccounts,
  next,
  onOpen,
  onJumpToDay,
}: {
  dueSoon: DueSoon;
  runway: Runway;
  /** Whether any bank, cash or wallet account holds the balance the line starts from. */
  hasAccounts: boolean;
  /** The first day with something going out, if any. */
  next: DueGroup | null;
  /** The card itself: scrolls down to Coming up. */
  onOpen: () => void;
  onJumpToDay: (date: string) => void;
}) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const none = dueSoon.count === 0;
  const picked = runway.days.find((d) => d.date === selected && d.items.length > 0) ?? null;
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
  const dayLabel = (d: RunwayDay) => moneyOf(d, 'label');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={
        none
          ? 'Nothing due in the next 14 days. Open Coming up'
          : `${formatMoney(dueSoon.totalMinor)} due in the next 14 days. Open Coming up`
      }
    >
      <Glass radius={28} tone="strong" style={[styles.card, styles.cardFirst]}>
        <View style={styles.head}>
          <Kicker icon="calendar">Next 14 days</Kicker>
          {!none && (
            <PlanChip>
              {dueSoon.count} payment{dueSoon.count === 1 ? '' : 's'}
            </PlanChip>
          )}
        </View>
        {none ? (
          <Text style={styles.bigNothing}>Nothing due</Text>
        ) : (
          <View style={styles.bigRow}>
            <Text style={styles.bigValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(dueSoon.totalMinor)}
            </Text>
            <Text style={styles.bigNote}>going out</Text>
          </View>
        )}
        {hasAccounts && (!none || runway.inMinor > 0) && (
          <View style={styles.chips}>
            {!none &&
              (runway.short ? (
                <PlanChip icon="alert-triangle" tone="bad">
                  Short {formatMoney(runway.short.minor)} on {dayMonth(runway.short.date)}
                </PlanChip>
              ) : (
                <PlanChip icon="check" tone="ok">
                  Your accounts cover it
                </PlanChip>
              ))}
            {runway.inMinor > 0 && (
              <PlanChip icon="arrow-down-left">+{formatMoney(runway.inMinor)} coming in</PlanChip>
            )}
          </View>
        )}

        {hasAccounts && (
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
              <Text style={styles.runwayStart} accessibilityElementsHidden importantForAccessibility="no">
                {compactMoney(runway.startMinor)}
              </Text>
              {width > 0 && !runway.short && !none && lowIndex >= 0 && (
                <Text
                  style={[
                    styles.runwayLow,
                    {
                      left: Math.min(Math.max(0, x(lowIndex) - 20), width - 64),
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
                  const on = picked?.date === d.date;
                  const color = pinColor(d);
                  return (
                    <Pressable
                      key={d.date}
                      onPress={() => {
                        haptics.tap();
                        setSelected(on ? null : d.date);
                      }}
                      style={[
                        styles.pin,
                        { left: x(i) - PIN / 2, top: (y(d.beforeMinor) + y(d.afterMinor)) / 2 - PIN / 2 },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${weekdayDayMonth(d.date)}, ${dayLabel(d)}. ${on ? 'Hide details' : 'Show details'}`}
                    >
                      <View style={[styles.pinDot, on && styles.pinDotOn, { borderColor: color }]} />
                    </Pressable>
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

        <Foot
          picked={picked}
          runway={runway}
          hasAccounts={hasAccounts}
          none={none}
          next={next}
          onJumpToDay={onJumpToDay}
        />
      </Glass>
    </Pressable>
  );
}

/**
 * A day's money. For a screen reader: "₹20,000 due", "₹50,000 coming in", or both. For the caption: "₹20,000",
 * "+₹50,000", or "₹20,000 out, +₹50,000 in" on a day with both.
 */
function moneyOf(d: RunwayDay, mode: 'label' | 'caption'): string {
  const out = d.outMinor > 0 ? formatMoney(d.outMinor) : '';
  const inn = d.inMinor > 0 ? formatMoney(d.inMinor) : '';
  if (mode === 'label') {
    return [out && `${out} due`, inn && `${inn} coming in`].filter(Boolean).join(', ');
  }
  if (out && inn) return `${out} out, +${inn} in`;
  return out || `+${inn}`;
}

function Foot({
  picked,
  runway,
  hasAccounts,
  none,
  next,
  onJumpToDay,
}: {
  picked: RunwayDay | null;
  runway: Runway;
  hasAccounts: boolean;
  none: boolean;
  next: DueGroup | null;
  onJumpToDay: (date: string) => void;
}) {
  if (picked) {
    return (
      <View style={styles.foot}>
        <Text style={styles.footText} numberOfLines={2}>
          <Text style={styles.footBold}>{weekdayDayMonth(picked.date)}</Text> · {moneyOf(picked, 'caption')} ·{' '}
          {picked.items.map((i) => i.title).join(', ')}
        </Text>
        <Pressable
          onPress={() => onJumpToDay(picked.date)}
          hitSlop={8}
          style={withPressed(styles.jump)}
          accessibilityRole="button"
          accessibilityLabel={`See ${weekdayDayMonth(picked.date)} in the list`}
        >
          <Text style={styles.jumpText}>See in list</Text>
          <Feather name="arrow-down" size={14} color={theme.colors.link} />
        </Pressable>
      </View>
    );
  }
  let body: React.ReactNode = null;
  if (hasAccounts && none) {
    body = (
      <>
        Your spending accounts hold <Text style={styles.footBold}>{formatMoney(runway.startMinor)}</Text>.
        Bills and EMIs you add show up on this line.
      </>
    );
  } else if (hasAccounts && runway.short) {
    body = (
      <>
        Your balance goes below {formatMoney(0)} on{' '}
        <Text style={styles.footBold}>{weekdayDayMonth(runway.short.date)}</Text>. Move money in before then.
      </>
    );
  } else if (hasAccounts) {
    body = (
      <>
        Your spending accounts end the fortnight at{' '}
        <Text style={styles.footBold}>{formatMoney(runway.endMinor)}</Text>. Lowest is{' '}
        {formatMoney(runway.lowMinor)} on {dayMonth(runway.lowDate)}.
      </>
    );
  } else if (next && next.outMinor > 0) {
    body = (
      <>
        Next: <Text style={styles.footBold}>{weekdayDayMonth(next.date)}</Text> ({formatMoney(next.outMinor)}
        ), {dueDateLabel(next.date).replace('Due ', '').toLowerCase()}
      </>
    );
  }
  if (!body) return null;
  return (
    <View style={styles.foot}>
      <Text style={styles.footText}>{body}</Text>
    </View>
  );
}
