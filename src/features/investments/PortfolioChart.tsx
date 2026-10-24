import { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { daysBetween } from '@/lib/investment';
import { formatMaskableMoney } from '@/lib/money';
import { dayMonthYear } from '@/lib/dateLabels';
import type { SeriesPoint } from '@/lib/portfolio';

const HEIGHT = 112;
const PAD = 8;

/**
 * Worth against money put in, one point per value update. The gap between the lines is the gain. With
 * hidden amounts only the shape shows: no figures in the labels.
 */
export function PortfolioChart({
  points,
  currency,
  masked,
  color,
}: {
  points: SeriesPoint[];
  currency: string;
  masked: boolean;
  color: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  if (points.length < 2) {
    return (
      <Text style={styles.empty}>
        The trend appears once you have updated a value, or put money in, on two different days.
      </Text>
    );
  }
  const first = points[0].date;
  const span = Math.max(1, daysBetween(first, points[points.length - 1].date));
  const all = points.flatMap((p) => [p.valueMinor, p.putInMinor]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const range = Math.max(1, hi - lo);
  const x = (date: string) =>
    PAD + (width > 2 * PAD ? ((width - 2 * PAD) * daysBetween(first, date)) / span : 0);
  const y = (v: number) => PAD + (HEIGHT - 2 * PAD) * (1 - (v - lo) / range);
  const line = (pick: (p: SeriesPoint) => number) =>
    points.map((p) => `${x(p.date).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const label = `Worth ${formatMaskableMoney(last.valueMinor, { currency, masked })}, put in ${formatMaskableMoney(last.putInMinor, { currency, masked })}, from ${dayMonthYear(first)} to ${dayMonthYear(last.date)}`;
  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={label}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Line
            x1={PAD}
            x2={width - PAD}
            y1={HEIGHT - PAD}
            y2={HEIGHT - PAD}
            stroke={theme.colors.borderSoft}
            strokeWidth={1}
          />
          <Polyline
            points={line((p) => p.putInMinor)}
            fill="none"
            stroke={theme.colors.textMuted}
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          <Polyline
            points={line((p) => p.valueMinor)}
            fill="none"
            stroke={color}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Circle cx={x(last.date)} cy={y(last.valueMinor)} r={4} fill={color} />
        </Svg>
      )}
      <View style={styles.axis}>
        <Text style={styles.axisText}>{dayMonthYear(first)}</Text>
        <Text style={styles.axisText}>{dayMonthYear(last.date)}</Text>
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text style={styles.axisText}>Worth</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.dashed]} />
          <Text style={styles.axisText}>Put in</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: PAD, marginTop: 2 },
  axisText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  legend: { flexDirection: 'row', gap: 14, paddingHorizontal: PAD, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  dashed: { backgroundColor: theme.colors.textMuted, opacity: 0.6 },
});
