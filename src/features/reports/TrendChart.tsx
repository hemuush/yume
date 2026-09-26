import { useState } from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { Text } from '@/components/Text';
import type { NetWorthPoint, TrendPoint } from '@/db/reports';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { styles } from './reports.styles';

/** A trend needs at least this many points to be worth drawing. */
const MIN_POINTS = 3;
const H = 150;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 118;
const LABEL_Y = 140;
const PAD_X = 14;

type Kind = 'spend' | 'netWorth';

/**
 * Trends as one line chart with a Spending / Net worth switch (the Reports
 * sign-off). Spending plots the last months against a dashed line for your
 * average (the baseline Reports' headline compares against), with this
 * period's point marked; net worth plots its path with the latest point
 * marked. The line under the chart says it in words.
 */
export function TrendChart({
  periodName,
  spentMinor,
  trend,
  baseline,
  netWorthTrend,
}: {
  periodName: string;
  /** This period's exact spend — compared against the baseline. */
  spentMinor: number;
  trend: TrendPoint[];
  baseline: number | null;
  netWorthTrend: NetWorthPoint[];
}) {
  const hasSpend = trend.length >= MIN_POINTS;
  const hasNw = netWorthTrend.length >= MIN_POINTS;
  const [kind, setKind] = useState<Kind>(hasSpend ? 'spend' : 'netWorth');
  const [width, setWidth] = useState(0);
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

  const nwFirst = netWorthTrend[0]?.netWorthMinor ?? 0;
  const nwLast = netWorthTrend[netWorthTrend.length - 1]?.netWorthMinor ?? 0;
  const nwDelta = roundedMinor(nwLast - nwFirst);
  const read =
    showing === 'spend'
      ? avg != null
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
                  style={[styles.trendSwitchBtn, on && styles.trendSwitchBtnOn]}
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

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }}>
        {width > 0 && (
          <Svg width={width} height={H}>
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
              </>
            )}
            <Polyline
              points={line}
              fill="none"
              stroke={theme.colors.ink}
              strokeOpacity={0.75}
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => {
              const last = i === points.length - 1;
              return (
                <Circle
                  key={`d-${i}`}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={last ? 5 : 3}
                  fill={last ? theme.colors.ink : theme.colors.surface}
                  stroke={theme.colors.ink}
                  strokeWidth={last ? 0 : 1.5}
                />
              );
            })}
            {points.map((p, i) => {
              const last = i === points.length - 1;
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
    </View>
  );
}
