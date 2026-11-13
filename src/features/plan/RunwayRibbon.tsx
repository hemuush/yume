import { useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { Text, MAX_FONT_SCALE } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { useScrub } from '@/features/reports/useScrub';
import { Runway, runwayTicks, TICK_DATE_WIDTH } from './runway';

/** The balance line's height; the pips and date labels sit under it. */
const LINE_H = 62;
const TOP = 6;
const PIP_ROW = 14;

/**
 * Overview's compact runway: a short balance line over the days ahead, a row of pips under it (coral where
 * money goes out, green where it comes in), and one line reading the day picked. It opens on the first day the
 * balance runs short, or the lowest day; tap or drag to read another. The full chart is in Forecast details.
 */
export function RunwayRibbon({ runway }: { runway: Runway }) {
  const { accent } = useAccent();
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(MAX_FONT_SCALE, Math.max(1, fontScale));
  const [width, setWidth] = useState(0);
  const days = runway.days;
  const n = days.length;
  const home = runway.short
    ? days.findIndex((d) => d.date === runway.short!.date)
    : days.findIndex((d) => d.date === runway.lowDate);
  const [picked, setPicked] = useState<number | null>(null);
  const sel = Math.max(0, Math.min(n - 1, picked ?? (home >= 0 ? home : 0)));
  const cell = n > 0 ? width / n : 0;
  const scrub = useScrub({ count: n, inset: cell / 2, onPick: setPicked });

  const { x, y, line, zero } = useMemo(() => {
    const balances = days.map((d) => d.afterMinor);
    const hi0 = Math.max(0, ...balances, runway.startMinor);
    const lo0 = Math.min(0, ...balances, runway.startMinor);
    const margin = Math.max(1, (hi0 - lo0) * 0.08);
    const hi = hi0 + margin;
    const lo = lo0 < 0 ? lo0 - margin : lo0;
    const y = (v: number) => TOP + (1 - (v - lo) / Math.max(1, hi - lo)) * (LINE_H - 2 - TOP);
    const x = (i: number) => (i + 0.5) * cell;
    const points = days.map((d, i) => `${x(i).toFixed(1)},${y(d.afterMinor).toFixed(1)}`);
    const start = `0,${y(runway.startMinor).toFixed(1)}`;
    return {
      x,
      y,
      line: `M${start} L${points.join(' L')} L${(n * cell).toFixed(1)},${y(days[n - 1]?.afterMinor ?? 0).toFixed(1)}`,
      zero: y(0),
    };
  }, [days, n, cell, runway.startMinor]);

  if (n === 0) return null;
  const day = days[sel];
  const negative = day.afterMinor < 0;
  const first = day.items[0];
  const moved = first
    ? `${first.title} ${first.kind === 'income' || first.transfer?.flow === 'in' ? '+' : '−'}${formatMoney(first.amountMinor)}${
        day.items.length > 1 ? ` +${day.items.length - 1} more` : ''
      }`
    : 'Nothing scheduled';
  const labelW = Math.round(48 * scale);
  const ticks = runwayTicks(n, x, TICK_DATE_WIDTH * scale);
  const stroke = negative ? theme.colors.expenseText : shade(accent, 50);

  return (
    <View style={styles.wrap}>
      <View
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          scrub.onLayout(e.nativeEvent.layout.width);
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Balance on ${weekdayDayMonth(day.date)}: ${formatMoney(day.afterMinor)}. ${moved}. Swipe to change day`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          setPicked(Math.max(0, Math.min(n - 1, sel + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))
        }
      >
        <View style={{ height: LINE_H }}>
          {width > 0 && (
            <Svg width={width} height={LINE_H} pointerEvents="none">
              <Path
                d={`${line} L${width},${zero.toFixed(1)} L0,${zero.toFixed(1)} Z`}
                fill={shade(accent, 93)}
              />
              <Line x1={0} x2={width} y1={zero} y2={zero} stroke={theme.colors.borderSoft} strokeWidth={1} />
              <Path
                d={line}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Line
                x1={x(sel)}
                x2={x(sel)}
                y1={0}
                y2={LINE_H}
                stroke={theme.colors.inkOff}
                strokeDasharray="2 3"
              />
              <Circle
                cx={x(sel)}
                cy={y(day.afterMinor)}
                r={4.5}
                fill={theme.colors.surface}
                stroke={theme.colors.ink}
                strokeWidth={2}
              />
            </Svg>
          )}
        </View>
        <View style={styles.pips} pointerEvents="none">
          {days.map((d, i) => (
            <View key={d.date} style={styles.pipSlot}>
              <View
                style={[
                  styles.pip,
                  d.items.length > 0 && {
                    backgroundColor: d.outMinor > 0 ? theme.colors.idCoralDeep : theme.colors.income,
                  },
                  i === sel && styles.pipOn,
                ]}
              />
            </View>
          ))}
        </View>
        <View style={{ height: Math.round(16 * scale) }} pointerEvents="none">
          {width > 0 &&
            ticks.map((i) => (
              <Text
                key={i}
                numberOfLines={1}
                style={[
                  styles.tick,
                  { width: labelW, left: Math.max(0, Math.min(width - labelW, x(i) - labelW / 2)) },
                  i === 0 && { textAlign: 'left', left: 0 },
                ]}
              >
                {i === 0 ? 'Today' : dayMonth(days[i].date)}
              </Text>
            ))}
        </View>
        <View style={StyleSheet.absoluteFill} {...scrub.panHandlers} />
      </View>
      <View style={styles.read}>
        <Text style={styles.readDate}>{weekdayDayMonth(day.date)}</Text>
        <Text
          style={[
            styles.readMoved,
            first && (first.kind === 'income' || first.transfer?.flow === 'in') && styles.in,
          ]}
        >
          {moved}
        </Text>
        <Text style={[styles.readLeft, negative && styles.short]}>leaves {formatMoney(day.afterMinor)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  pips: { flexDirection: 'row', height: PIP_ROW, alignItems: 'center' },
  pipSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pip: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.trayTrack },
  pipOn: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.ink },
  tick: {
    position: 'absolute',
    top: 0,
    textAlign: 'center',
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  read: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 8,
    rowGap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.tray,
  },
  readDate: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  readMoved: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 120,
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  readLeft: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  in: { color: theme.colors.incomeText },
  short: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
});
