import { useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Text, MAX_FONT_SCALE } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { compactMoney } from '@/lib/compactMoney';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { useScrub } from '@/features/reports/useScrub';
import { guideValues, smoothPath } from '@/lib/chartPath';
import type { Runway } from './runway';

const TOP = 30;
const PAD = 8;

/**
 * The chart's fixed layout, grown with the text size: its axis labels are placed by hand, so at a larger font
 * the side gutter, the date row and the day label need more room or they wrap into each other.
 */
function metrics(scale: number) {
  const H = Math.round(176 + (scale - 1) * 26);
  return {
    H,
    BASE: H - Math.round(36 * scale),
    EVENTS_Y: H - Math.round(22 * scale),
    TICK_TOP: H - Math.round(14 * scale),
    GUTTER: Math.round(36 * scale),
    LABEL_W: Math.round(44 * scale),
    PILL_H: Math.round(20 * scale),
    CHAR_W: 6.4 * scale,
  };
}
const TICK_GAP = 26;

/**
 * The runway as a smooth balance line over the days ahead: a faint ₹0 line and round guides to read it by, a
 * dot under every day money moves (green in, coral out), and a label on the day being read. It opens on the
 * first day the balance runs short, or the lowest day; touch and drag to read any other. Below zero the area
 * tints coral. The readout under it names the payments.
 */
export function RunwayChart({ runway }: { runway: Runway }) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(MAX_FONT_SCALE, Math.max(1, fontScale));
  const { H, BASE, EVENTS_Y, TICK_TOP, GUTTER, LABEL_W, PILL_H, CHAR_W } = metrics(scale);
  const days = runway.days;
  const n = days.length;
  const home = runway.short
    ? days.findIndex((d) => d.date === runway.short!.date)
    : days.findIndex((d) => d.date === runway.lowDate);
  const [picked, setPicked] = useState<number | null>(null);
  const sel = Math.max(0, Math.min(n - 1, picked ?? (home >= 0 ? home : 0)));
  const scrub = useScrub({ count: n, inset: PAD, onPick: setPicked });

  // The curve, guides and scale depend only on the runway and the width, not on the day being read, so a drag
  // (which re-renders on every move) reuses them.
  const { x, y, line, zero, guides, ticks, below } = useMemo(() => {
    const balances = days.map((d) => d.afterMinor);
    const hi0 = Math.max(0, ...balances, runway.startMinor);
    const lo0 = Math.min(0, ...balances, runway.startMinor);
    const margin = Math.max(1, (hi0 - lo0) * 0.08);
    const hi = hi0 + margin;
    const lo = lo0 < 0 ? lo0 - margin : lo0;
    const y = (v: number) => TOP + (1 - (v - lo) / Math.max(1, hi - lo)) * (BASE - TOP);
    const plot = Math.max(0, width - GUTTER);
    const x = (i: number) => GUTTER + PAD + (n <= 1 ? 0 : (i / (n - 1)) * Math.max(0, plot - 2 * PAD));
    const line = smoothPath(days.map((d, i) => ({ x: x(i), y: y(d.afterMinor) })));

    const guides: number[] = [];
    let lastY = Infinity;
    for (const v of guideValues(lo, hi).reverse()) {
      if (Math.abs(y(v) - lastY) < TICK_GAP) continue;
      guides.push(v);
      lastY = y(v);
    }
    const ticks: number[] = [0];
    for (let i = 7; i <= n - 4; i += 7) ticks.push(i);
    return { x, y, line, zero: y(0), guides, ticks, below: lo < 0 };
  }, [days, n, runway.startMinor, width, BASE, GUTTER]);

  const plot = Math.max(0, width - GUTTER);
  const day = days[sel];
  const negative = day.afterMinor < 0;
  const pill = `${dayMonth(day.date)} · ${formatMoney(day.afterMinor)}`;
  const pillW = pill.length * CHAR_W + 18;
  const pillLeft = Math.max(2, Math.min(width - pillW - 2, x(sel) - pillW / 2));
  const moved = day.items.map(
    (it) => `${it.title} ${it.kind === 'income' ? '+' : '−'}${formatMoney(it.amountMinor)}`
  );

  return (
    <View>
      <View
        style={[styles.chart, { height: H }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Balance on ${weekdayDayMonth(day.date)}: ${formatMoney(day.afterMinor)}. Swipe to change day`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          setPicked(Math.max(0, Math.min(n - 1, sel + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))
        }
      >
        {width > 0 && n > 0 && (
          <>
            <Svg width={width} height={H} pointerEvents="none">
              <Defs>
                <LinearGradient id="runwayFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.colors.slice.saved} stopOpacity={0.38} />
                  <Stop offset="1" stopColor={theme.colors.slice.saved} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>
              {below && (
                <Rect
                  x={GUTTER}
                  y={zero}
                  width={plot}
                  height={BASE - zero}
                  fill={theme.colors.expenseTint}
                  opacity={0.7}
                />
              )}
              {guides.map((v) => (
                <Line
                  key={v}
                  x1={GUTTER}
                  x2={width}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={v === 0 ? theme.colors.otherSlice : theme.colors.divider}
                  strokeWidth={1}
                />
              ))}
              {n > 1 && (
                <Path
                  d={`${line} L${x(n - 1).toFixed(1)},${zero.toFixed(1)} L${x(0).toFixed(1)},${zero.toFixed(1)} Z`}
                  fill="url(#runwayFill)"
                />
              )}
              <Path
                d={line}
                fill="none"
                stroke={theme.colors.ink}
                strokeWidth={2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {days.map(
                (d, i) =>
                  d.items.length > 0 && (
                    <Circle
                      key={d.date}
                      cx={x(i)}
                      cy={EVENTS_Y}
                      r={3.2}
                      fill={d.outMinor > 0 ? theme.colors.idCoralDeep : theme.colors.slice.saved}
                    />
                  )
              )}
              <Line
                x1={x(sel)}
                x2={x(sel)}
                y1={TOP - 6}
                y2={EVENTS_Y - 8}
                stroke={theme.colors.inkLine}
                strokeDasharray="2 3"
              />
              <Circle
                cx={x(sel)}
                cy={y(day.afterMinor)}
                r={5.5}
                fill={theme.colors.ink}
                stroke={theme.colors.surface}
                strokeWidth={2.5}
              />
            </Svg>
            {guides.map((v) => (
              <Text
                key={`g${v}`}
                style={[styles.axis, styles.guide, { top: y(v) - 7 * scale, width: GUTTER - 6 }]}
              >
                {compactMoney(v)}
              </Text>
            ))}
            {ticks.map((i) => (
              <Text
                key={`t${i}`}
                style={[
                  styles.axis,
                  styles.tick,
                  {
                    top: TICK_TOP,
                    width: LABEL_W,
                    left: Math.max(0, Math.min(width - LABEL_W, x(i) - LABEL_W / 2)),
                  },
                ]}
              >
                {i === 0 ? 'Today' : dayMonth(days[i].date)}
              </Text>
            ))}
            <View
              style={[
                styles.pill,
                negative && styles.pillShort,
                { left: pillLeft, width: pillW, height: PILL_H },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.pillText} numberOfLines={1}>
                {pill}
              </Text>
            </View>
            <View
              style={[styles.touch, { left: GUTTER, height: H }]}
              onLayout={(e) => scrub.onLayout(e.nativeEvent.layout.width)}
              {...scrub.panHandlers}
            />
          </>
        )}
      </View>
      <View style={styles.read}>
        <View style={styles.readHead}>
          <Text style={styles.date}>{weekdayDayMonth(day.date)}</Text>
          <Text style={[styles.bal, negative && { color: theme.colors.expenseText }]}>
            {formatMoney(day.afterMinor)}
          </Text>
        </View>
        <Text style={styles.moved}>{moved.length ? moved.join(' · ') : 'Nothing due'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { marginTop: 12 },
  touch: { position: 'absolute', top: 0, right: 0 },
  axis: { position: 'absolute', fontFamily: theme.font.body, fontSize: 10, color: theme.colors.textMuted },
  guide: { left: 0, textAlign: 'right' },
  tick: { textAlign: 'center' },
  pill: {
    position: 'absolute',
    top: 0,
    borderRadius: 14,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillShort: { backgroundColor: theme.colors.expenseText },
  pillText: { fontFamily: theme.font.bodyBold, fontSize: 10, color: theme.colors.surface },
  read: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  readHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  date: {
    fontFamily: theme.font.bodyMedium,
    fontSize: theme.typeSize.row - 1,
    color: theme.colors.textSecondary,
  },
  bal: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  moved: { fontFamily: theme.font.body, fontSize: theme.typeSize.row - 1, color: theme.colors.textSecondary },
});
