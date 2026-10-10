import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { formatMoney } from '@/lib/money';
import { SpendBar, ChartLegendItem } from './spendChart';

const MAX_BAR_HEIGHT = 60;
// A day with any spend is at least this tall, so a small one still reads as a bar.
const MIN_BAR_HEIGHT = 6;
// Only 7 daily bars or ~4-5 weekly ones at a time, so a tighter cap than the
// heatmap's (which can stagger a whole month of cells) still finishes fast.
const MAX_STAGGER_MS = 220;

/**
 * One bar's stack: grows from 0 once on first appearance (staggered by `delay`), then glides between heights.
 * It never drops back to 0 first, which made every bar blink on each entry, scope switch and period change.
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
      grown.current = true;
      v.setValue(heightPct);
      return;
    }
    const first = !grown.current;
    grown.current = true;
    const anim = Animated.timing(v, {
      toValue: heightPct,
      duration: first ? 420 : 280,
      delay: first ? delay : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    // Stopped when the bar goes or its height changes again, so no frame runs for a bar that has left.
    return () => anim.stop();
  }, [heightPct, reduce, delay, v]);

  const scaleY = v.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View
      style={[style, { height: MAX_BAR_HEIGHT, transformOrigin: 'bottom', transform: [{ scaleY }] }]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * One stacked bar per period (a day in Week, a calendar week in Month); zero-spend gets a baseline tick.
 * Tapping calls `onPressDay` (no fetching/filtering here); bar counts stay small (7 / ~5): no dense mode.
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
        const barPx =
          bar.totalMinor > 0 ? Math.max(MIN_BAR_HEIGHT, (bar.totalMinor / maxTotal) * MAX_BAR_HEIGHT) : 0;
        const heightPct = (barPx / MAX_BAR_HEIGHT) * 100;
        const segmentTotal = bar.segments.reduce((sum, seg) => sum + Math.max(0, seg.amountMinor), 0);
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
            accessibilityLabel={`${bar.key} (${bar.label})${bar.totalMinor > 0 ? `, spent ${formatMoney(bar.totalMinor)}` : ', nothing spent'}`}
          >
            <View style={[styles.barTrack, selected && styles.barLifted]}>
              {bar.totalMinor > 0 ? (
                <AnimatedBarStack
                  heightPct={heightPct}
                  delay={Math.min(i * 45, MAX_STAGGER_MS)}
                  style={styles.stack}
                >
                  {/* Positive category weights fill the stack; a refund in another category can
                      make their sum exceed net spending. Keep net height and category amounts intact. */}
                  {bar.segments.map((seg) => (
                    <View
                      key={seg.categoryId}
                      style={[
                        styles.segment,
                        {
                          backgroundColor: seg.color,
                          height: `${(Math.max(0, seg.amountMinor) / Math.max(1, segmentTotal)) * 100}%`,
                        },
                      ]}
                    />
                  ))}
                </AnimatedBarStack>
              ) : (
                <View style={styles.baseline} />
              )}
              {selected && (
                <View style={[styles.bubbleWrap, { bottom: Math.max(barPx, 2) + 6 }]} pointerEvents="none">
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText} numberOfLines={1}>
                      {formatMoney(bar.totalMinor)}
                    </Text>
                    <View style={styles.bubbleNub} />
                  </View>
                </View>
              )}
            </View>
            {bar.isCurrent ? (
              <View style={styles.todayPill}>
                <Text style={styles.todayText}>{bar.label}</Text>
              </View>
            ) : (
              <Text style={styles.label}>{bar.label}</Text>
            )}
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
    width: 18,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'column-reverse',
  },
  segment: { width: '100%' },
  baseline: { width: 18, height: 2, borderRadius: 1, backgroundColor: theme.colors.borderSoft },
  outsideDay: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.textMuted,
    opacity: 0.35,
  },
  futureDay: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.borderSoft,
    opacity: 0.5,
  },
  labelAway: { opacity: 0.45 },
  label: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    lineHeight: 13,
    minHeight: 13,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  todayPill: {
    height: 15,
    marginTop: 6,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: theme.colors.ink,
  },
  todayText: { fontFamily: theme.font.monoBold, fontSize: 9, lineHeight: 13, color: theme.colors.surface },
  bubbleWrap: { position: 'absolute', left: -24, right: -24, alignItems: 'center' },
  bubble: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.colors.ink },
  bubbleText: { fontFamily: theme.font.monoBold, fontSize: 10.5, color: theme.colors.surface },
  bubbleNub: {
    position: 'absolute',
    bottom: -3,
    alignSelf: 'center',
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: theme.colors.ink,
    transform: [{ rotate: '45deg' }],
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', flexShrink: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 3, flexShrink: 0 },
  legendText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textSecondary, flexShrink: 1 },
  legendMore: { color: theme.colors.textMuted },
});
