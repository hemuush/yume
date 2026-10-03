import { useState } from 'react';
import { Animated, View, Pressable } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { Text } from '@/components/Text';
import type { NetWorthPoint, TrendPoint } from '@/db/reports';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { styles } from './reports.styles';
import { withPressed } from '@/lib/pressed';
import { useGrowFrom } from '@/lib/useGrowFrom';

/** A trend needs at least this many points to be worth drawing. */
export const MIN_TREND_POINTS = 3;
const H = 150;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 118;
const LABEL_Y = 140;
const PAD_X = 14;

type Kind = 'spend' | 'netWorth';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const DRAW_MS = 800;

/** The chart's line, drawn in from its first month once after app open; still when you come back to it. */
function DrawnLine({ animKey, coords }: { animKey: string; coords: { x: number; y: number }[] }) {
  const draw = useGrowFrom(animKey, 1, { drawMs: DRAW_MS });
  let length = 0;
  for (let i = 1; i < coords.length; i++) {
    length += Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y);
  }
  length = Math.ceil(length) + 1;
  return (
    <AnimatedPolyline
      points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
      fill="none"
      stroke={theme.colors.ink}
      strokeOpacity={0.75}
      strokeWidth={2.2}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={length}
      strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [length, 0] })}
    />
  );
}

/**
 * Trends line chart, Spending / Net worth switch: spending vs a dashed average (Reports' headline baseline),
 * or net worth's path. Touch/drag picks a month; one off-screen can offer `monthLink` to move Reports to it.
 */
export function TrendChart({
  periodName,
  spentMinor,
  trend,
  baseline,
  inProgress = false,
  netWorthTrend,
  monthLink,
}: {
  periodName: string;
  /** This period's exact spend — compared against the baseline. */
  spentMinor: number;
  trend: TrendPoint[];
  baseline: number | null;
  /** The last point is a month still going: drawn dashed and hollow, and read as "so far". */
  inProgress?: boolean;
  netWorthTrend: NetWorthPoint[];
  /** For the picked point (its index and the point count): the month it stands for and how to open it; null if it can't be. */
  monthLink?: (index: number, count: number) => { name: string; open: () => void } | null;
}) {
  const hasSpend = trend.length >= MIN_TREND_POINTS;
  const hasNw = netWorthTrend.length >= MIN_TREND_POINTS;
  const [kind, setKind] = useState<Kind>(hasSpend ? 'spend' : 'netWorth');
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  if (!hasSpend && !hasNw) return null;
  const showing: Kind =
    kind === 'spend' && !hasSpend ? 'netWorth' : kind === 'netWorth' && !hasNw ? 'spend' : kind;

  const points =
    showing === 'spend'
      ? trend.map((t) => ({ label: t.label, value: t.totalMinor }))
      : netWorthTrend.map((t) => ({ label: t.label, value: t.netWorthMinor }));
  const avg = showing === 'spend' ? baseline : null;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values, avg ?? Infinity);
  const hi = Math.max(...values, avg ?? -Infinity);
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
  const y = (v: number) => PLOT_BOTTOM - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (PLOT_BOTTOM - PLOT_TOP);
  const x = (i: number) => PAD_X + (i * (width - 2 * PAD_X)) / Math.max(1, points.length - 1);
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const partial = showing === 'spend' && inProgress && points.length >= 2;
  const lastI = points.length - 1;
  const selI = sel != null && sel <= lastI ? sel : lastI;
  const solidCoords = (partial ? points.slice(0, -1) : points).map((p, i) => ({ x: x(i), y: y(p.value) }));

  const pickAt = (locationX: number) => {
    if (width <= 2 * PAD_X) return;
    const i = Math.round(((locationX - PAD_X) / (width - 2 * PAD_X)) * lastI);
    const next = Math.max(0, Math.min(lastI, i));
    if (next === selI) return;
    haptics.tap();
    setSel(next);
  };

  const nwFirst = netWorthTrend[0]?.netWorthMinor ?? 0;
  const nwLast = netWorthTrend[netWorthTrend.length - 1]?.netWorthMinor ?? 0;
  const nwDelta = roundedMinor(nwLast - nwFirst);
  const pointRead = (() => {
    const p = points[selI];
    const money = formatMoney(roundedMinor(p.value));
    if (showing === 'spend') {
      if (avg == null || avg <= 0) return `${p.label}: ${money}`;
      const pct = Math.round((Math.abs(p.value - avg) / avg) * 100);
      return `${p.label}: ${money} · ${pct}% ${p.value >= avg ? 'above' : 'below'} your usual`;
    }
    const before = selI > 0 ? points[selI - 1] : null;
    if (!before) return `${p.label}: ${money} net worth`;
    const diff = roundedMinor(p.value - before.value);
    return `${p.label}: ${money} net worth · ${diff >= 0 ? 'up' : 'down'} ${formatMoney(Math.abs(diff))} on ${before.label}`;
  })();
  const link = monthLink ? monthLink(selI, points.length) : null;
  const read =
    selI !== lastI
      ? pointRead
      : showing === 'spend'
        ? avg != null && partial
          ? `${periodName} so far: ${formatMoney(roundedMinor(spentMinor))}. The dashed line is your usual month, ${formatMoney(roundedMinor(avg))}.`
          : avg != null
            ? `${periodName} is ${formatMoney(Math.abs(roundedMinor(spentMinor - avg)))} ${
                spentMinor >= avg ? 'above' : 'below'
              } your average of ${formatMoney(roundedMinor(avg))}.`
            : `${periodName}: ${formatMoney(roundedMinor(spentMinor))} spent.`
        : `${nwDelta >= 0 ? 'Up' : 'Down'} ${formatMoney(Math.abs(nwDelta))} over the last ${netWorthTrend.length} months, now ${formatMoney(roundedMinor(nwLast))}.`;

  const pick = (k: Kind) => {
    if (k === showing) return;
    haptics.tap();
    setKind(k);
  };

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHead}>
        <Text style={styles.trendTitle}>{showing === 'spend' ? 'Spending' : 'Net worth'}</Text>
        {hasSpend && hasNw && (
          <View style={styles.trendSwitch} accessibilityRole="radiogroup">
            {(['spend', 'netWorth'] as const).map((k) => {
              const on = showing === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => pick(k)}
                  hitSlop={6}
                  style={withPressed([styles.trendSwitchBtn, on && styles.trendSwitchBtnOn])}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.trendSwitchText, on && styles.trendSwitchTextOn]}>
                    {k === 'spend' ? 'Spending' : 'Net worth'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View
        testID="trend-touch"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => pickAt(e.nativeEvent.locationX)}
        onResponderMove={(e) => pickAt(e.nativeEvent.locationX)}
        style={{ height: H }}
        accessibilityHint="Touch or drag along the chart to pick a month"
      >
        {width > 0 && (
          <Svg width={width} height={H} pointerEvents="none">
            <Polygon
              points={`${x(0)},${PLOT_BOTTOM + 4} ${line} ${x(points.length - 1)},${PLOT_BOTTOM + 4}`}
              fill={theme.colors.primary}
              fillOpacity={0.18}
            />
            {avg != null && (
              <>
                <Line
                  x1={PAD_X}
                  x2={width - PAD_X}
                  y1={y(avg)}
                  y2={y(avg)}
                  stroke={theme.colors.textMuted}
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                />
                {!partial && (
                  <SvgText
                    x={width - PAD_X}
                    y={y(avg) - 5}
                    textAnchor="end"
                    fontFamily={theme.font.body}
                    fontSize={10}
                    fill={theme.colors.textSecondary}
                  >
                    {`avg ${formatMoney(roundedMinor(avg))}`}
                  </SvgText>
                )}
              </>
            )}
            <DrawnLine animKey={`trend:${showing}:${points.length}`} coords={solidCoords} />
            {partial && (
              <Line
                x1={x(lastI - 1)}
                y1={y(points[lastI - 1].value)}
                x2={x(lastI)}
                y2={y(points[lastI].value)}
                stroke={theme.colors.ink}
                strokeOpacity={0.75}
                strokeWidth={2.2}
                strokeDasharray="3 5"
                strokeLinecap="round"
              />
            )}
            <Line
              x1={x(selI)}
              x2={x(selI)}
              y1={PLOT_TOP - 6}
              y2={PLOT_BOTTOM + 4}
              stroke={theme.colors.textMuted}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
            {points.map((p, i) => {
              const last = i === lastI;
              const on = i === selI;
              const hollow = last && partial && !on;
              const filled = (last && !hollow) || on;
              return (
                <Circle
                  key={`d-${i}`}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={on ? 6 : last ? 5 : 3}
                  fill={filled ? theme.colors.ink : theme.colors.surface}
                  stroke={on ? theme.colors.surface : theme.colors.ink}
                  strokeWidth={on ? 2 : filled ? 0 : 1.5}
                />
              );
            })}
            {points.map((p, i) => {
              const last = i === selI;
              return (
                <SvgText
                  key={`l-${i}`}
                  x={x(i)}
                  y={LABEL_Y}
                  textAnchor="middle"
                  fontFamily={last ? theme.font.monoBold : theme.font.mono}
                  fontSize={10}
                  fill={last ? theme.colors.textPrimary : theme.colors.textMuted}
                >
                  {p.label}
                </SvgText>
              );
            })}
          </Svg>
        )}
      </View>
      <Text style={styles.trendRead}>{read}</Text>
      {link && (
        <Pressable
          onPress={link.open}
          hitSlop={8}
          style={withPressed(styles.trendLink)}
          accessibilityRole="link"
        >
          <Text style={styles.trendLinkText}>Open {link.name} in Reports ›</Text>
        </Pressable>
      )}
    </View>
  );
}
