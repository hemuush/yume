import { View, Text } from 'react-native';
import { theme } from '@/constants/theme';
import { styles, BAR_MAX_HEIGHT } from './reports.styles';

/** ₹21,079 → "21k", ₹4,82,600 → "4.8L" — full rupee formatting doesn't fit above a ~35px-wide bar. */
export function compactRupees(minor: number): string {
  const rupees = Math.abs(minor) / 100;
  const sign = minor < 0 ? '-' : '';
  if (rupees >= 100000) return `${sign}₹${(rupees / 100000).toFixed(rupees % 100000 === 0 ? 0 : 1)}L`;
  if (rupees >= 1000) return `${sign}₹${Math.round(rupees / 1000)}k`;
  return `${sign}₹${Math.round(rupees)}`;
}

/**
 * The month-over-month trend, drawn as a plain labeled bar per month — the
 * signed-off replacement for the previous "constellation" dot-and-line
 * chart, which read as a shape but never told you what a given month
 * actually was without close inspection. Every bar carries its own value;
 * the current month's bar and label pick up `emphasisColor`. Same
 * `values`/`labels`/`baseline`/`emphasisColor` signature as before, so both
 * call sites (spend trend, net worth) are untouched.
 */
export function TrendBars({
  values,
  labels,
  baseline,
  emphasisColor = theme.colors.idCoralDeep,
}: {
  values: number[];
  labels: string[];
  baseline: number | null;
  /** Color of the current (last) bar + its value label — defaults to the
   *  same coral every existing caller (the spend trend, always non-negative)
   *  already uses. Net worth passes its own sign-aware color instead, since
   *  unlike a spend trend, net worth's sign is actually meaningful. */
  emphasisColor?: string;
}) {
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const barHeight = (v: number) => Math.max(3, ((v - min) / span) * BAR_MAX_HEIGHT);
  const lastIndex = values.length - 1;
  const baseBottom = baseline != null ? ((baseline - min) / span) * BAR_MAX_HEIGHT : null;
  // A 12-point year view would crowd every month's initial under the chart —
  // thin the axis to every other label past 8 points, always keeping the
  // current (last) one.
  const showLabel = (i: number) => values.length <= 8 || i === lastIndex || i % 2 === 0;
  return (
    <View>
      <View style={styles.barChart}>
        {baseBottom != null && <View style={[styles.barBaseline, { bottom: baseBottom }]} />}
        {values.map((v, i) => (
          <View key={i} style={styles.barCol}>
            <Text
              style={[styles.barValue, i === lastIndex && { color: emphasisColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {compactRupees(v)}
            </Text>
            <View
              style={[
                styles.bar,
                {
                  height: barHeight(v),
                  backgroundColor: i === lastIndex ? emphasisColor : theme.colors.borderSoft,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.sparkAxis}>
        {labels.map((label, i) => (
          <Text
            key={i}
            style={[styles.sparkAxisLabel, i === lastIndex && styles.sparkAxisLabelOn]}
            numberOfLines={1}
          >
            {showLabel(i) ? label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}
