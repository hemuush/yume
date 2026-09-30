import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { SpendBar, ChartLegendItem } from './spendChart';

const MAX_BAR_HEIGHT = 64;
// Only 7 daily bars or ~4-5 weekly ones at a time, so a tighter cap than the
// heatmap's (which can stagger a whole month of cells) still finishes fast.
const MAX_STAGGER_MS = 220;

/**
 * One bar's stack: it grows up from 0 once, when it first appears (staggered
 * per bar via `delay`), and after that glides from its current height to a
 * new one. It never drops back to 0 first — that made every bar blink on
 * each new entry, Week/Month switch and period change.
 */
function AnimatedBarStack({
  heightPct,
  delay,
  style,
  children,
}: {
  heightPct: number;
  delay: number;
  style: React.ComponentProps<typeof Animated.View>['style'];
  children: React.ReactNode;
}) {
  const reduce = useReduceMotion();
  // The height itself, in percent.
  const [v] = useState(() => new Animated.Value(reduce ? heightPct : 0));
  const grown = useRef(false);

  useEffect(() => {
    if (reduce) {
      v.setValue(heightPct);
      return;
    }
    const first = !grown.current;
    grown.current = true;
    Animated.timing(v, {
      toValue: heightPct,
      duration: first ? 420 : 280,
      delay: first ? delay : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [heightPct, reduce, delay, v]);

  const height = v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
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
export function SpendBarChart({
  bars,
  onPressDay,
  selectedKey = null,
  inset = 22,
}: {
  bars: SpendBar[];
  onPressDay: (key: string) => void;
  /** The tapped bar: it lifts slightly and the rest fade back, so the chart shows what you picked. */
  selectedKey?: string | null;
  /** Side padding — 0 when the chart sits inside a card that already pads it. */
  inset?: number;
}) {
  const maxTotal = Math.max(1, ...bars.map((b) => b.totalMinor));

  return (
    <View style={[styles.row, { paddingHorizontal: inset }]}>
      {bars.map((bar, i) => {
        const heightPct = bar.totalMinor > 0 ? Math.max(6, (bar.totalMinor / maxTotal) * 100) : 0;
        const selected = selectedKey === bar.key;
        const faded = selectedKey != null && !selected;
        if (bar.state) {
          // Not a day of this week's month, or not here yet: a quiet placeholder, never tappable.
          return (
            <View key={bar.key} style={styles.col} accessibilityElementsHidden importantForAccessibility="no">
              <View style={styles.barTrack}>
                <View style={bar.state === 'outside' ? styles.outsideDay : styles.futureDay} />
              </View>
              <Text style={[styles.label, styles.labelAway]}>{bar.label}</Text>
            </View>
          );
        }
        return (
          <Pressable
            key={bar.key}
            onPress={() => onPressDay(bar.key)}
            style={[styles.col, faded && styles.colFaded]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${bar.label}${bar.totalMinor > 0 ? `, spent ${bar.totalMinor / 100}` : ', nothing spent'}`}
          >
            <View style={[styles.barTrack, selected && styles.barLifted]}>
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
export function ChartLegend({
  items,
  inset = 22,
  max,
}: {
  items: ChartLegendItem[];
  inset?: number;
  /** Names this many (the chart's biggest), then "+N more", so the legend stays one line. */
  max?: number;
}) {
  if (items.length === 0) return null;
  const shown = max != null && items.length > max ? items.slice(0, max) : items;
  const more = items.length - shown.length;
  return (
    <View style={[styles.legend, { paddingHorizontal: inset }]}>
      {shown.map((item) => (
        <View key={item.categoryId} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendText} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
      ))}
      {more > 0 && <Text style={[styles.legendText, styles.legendMore]}>+{more} more</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: MAX_BAR_HEIGHT + 22,
  },
  col: { width: `${100 / 7.4}%`, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  colFaded: { opacity: 0.35 },
  barTrack: { height: MAX_BAR_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  barLifted: { transform: [{ translateY: -3 }] },
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
  outsideDay: {
    width: 20,
    height: 14,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderSoft,
  },
  futureDay: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.borderSoft,
    opacity: 0.5,
  },
  labelAway: { opacity: 0.45 },
  label: { fontFamily: theme.font.mono, fontSize: 9, color: theme.colors.textMuted, marginTop: 8 },
  labelCurrent: { color: theme.colors.textPrimary, fontFamily: theme.font.monoBold },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  legendText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textSecondary },
  legendMore: { color: theme.colors.textMuted },
});
