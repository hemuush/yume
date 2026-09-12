import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { SpendBar, ChartLegendItem } from './spendChart';

const MAX_BAR_HEIGHT = 64;
// Only 7 daily bars or ~4-5 weekly ones at a time, so a tighter cap than the
// heatmap's (which can stagger a whole month of cells) still finishes fast.
const MAX_STAGGER_MS = 220;

/**
 * One bar's stack, growing up from 0 on mount and whenever its own height
 * changes (a period switch) — the same `Animated.timing` height-interpolation
 * `AnimatedCategoryFill` already uses for Reports' category rows, just
 * driving height instead of width and staggered per bar via `delay`.
 */
function AnimatedBarStack({
  heightPct,
  delay,
  style,
  children,
}: {
  heightPct: number;
  delay: number;
  style: any;
  children: React.ReactNode;
}) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));

  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: false }).start();
    // Re-running only when the target height itself changes, not on every
    // unrelated re-render of the chart it lives in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heightPct, reduce]);

  const height = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${heightPct}%`] });
  return <Animated.View style={[style, { height }]}>{children}</Animated.View>;
}

/**
 * One stacked bar per period (a day in Week scope, a calendar week in Month
 * scope) — the screen's headline visual, replacing the day-strip pill row
 * and every per-day summary card from earlier passes. A zero-spend period
 * gets a thin baseline tick instead of no bar at all, so it still has a slot
 * in the rhythm rather than a gap. Tapping a bar calls `onPressDay` so the
 * screen can scroll its already-grouped list to that period — the chart
 * never fetches or filters on its own.
 *
 * Bar counts stay small either way (7 daily bars for a week, ~4-5 weekly
 * bars for a month — see `buildWeeklySpendBars`), so there's deliberately
 * no separate "dense" mode anymore: a single generous layout reads fine at
 * both counts, and it removes what a dense 30-bar grid needed to lean on.
 */
export function SpendBarChart({ bars, onPressDay }: { bars: SpendBar[]; onPressDay: (key: string) => void }) {
  const maxTotal = Math.max(1, ...bars.map((b) => b.totalMinor));

  return (
    <View style={styles.row}>
      {bars.map((bar, i) => {
        const heightPct = bar.totalMinor > 0 ? Math.max(6, (bar.totalMinor / maxTotal) * 100) : 0;
        return (
          <Pressable
            key={bar.key}
            onPress={() => onPressDay(bar.key)}
            style={styles.col}
            accessibilityRole="button"
            accessibilityLabel={`${bar.label}${bar.totalMinor > 0 ? `, spent ${bar.totalMinor / 100}` : ', nothing spent'}`}
          >
            <View style={styles.barTrack}>
              {bar.totalMinor > 0 ? (
                <AnimatedBarStack
                  heightPct={heightPct}
                  delay={Math.min(i * 45, MAX_STAGGER_MS)}
                  style={[styles.stack, bar.isCurrent && styles.stackCurrent]}
                >
                  {/* Rendered bottom-up (column-reverse) so the largest
                      segment anchors the base, matching the builder's own
                      largest-first sort. Each segment's height is an
                      explicit percentage of the bar's own total, not a
                      `flex` ratio built from the segment's raw paise amount
                      — that number can run into the hundreds of thousands
                      for a single transaction, and Yoga doesn't lay out
                      `flex` reliably at that scale, which is what let
                      segments render overlapping instead of stacked. */}
                  {bar.segments.map((seg) => (
                    <View
                      key={seg.categoryId}
                      style={[
                        styles.segment,
                        {
                          backgroundColor: seg.color,
                          height: `${(seg.amountMinor / bar.totalMinor) * 100}%`,
                        },
                      ]}
                    />
                  ))}
                </AnimatedBarStack>
              ) : (
                <View style={styles.baseline} />
              )}
            </View>
            <Text style={[styles.label, bar.isCurrent && styles.labelCurrent]}>{bar.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The chart's own colour key — only the categories it's actually showing. */
export function ChartLegend({ items }: { items: ChartLegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.categoryId} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: MAX_BAR_HEIGHT + 22,
    paddingHorizontal: 22,
  },
  col: { width: `${100 / 7.4}%`, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { height: MAX_BAR_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  stack: {
    width: 20,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'column-reverse',
  },
  stackCurrent: {
    borderWidth: 2,
    borderColor: theme.colors.ink,
  },
  segment: { width: '100%' },
  baseline: { width: 20, height: 2, borderRadius: 1, backgroundColor: theme.colors.borderSoft },
  label: { fontFamily: theme.font.mono, fontSize: 9, color: theme.colors.textMuted, marginTop: 8 },
  labelCurrent: { color: theme.colors.textPrimary, fontFamily: theme.font.monoBold },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 22, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  legendText: { fontFamily: theme.font.body, fontSize: 9.5, color: theme.colors.textMuted },
});
