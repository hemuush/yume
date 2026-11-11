import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import { Text, MAX_FONT_SCALE } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { formatMoney } from '@/lib/money';
import { SpendBar, ChartLegendItem } from './spendChart';

import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { compactMoney } from '@/lib/compactMoney';
import { shade } from '@/lib/color';

const MAX_BAR_HEIGHT = 36;
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
  dates = false,
  amounts = false,
}: {
  bars: SpendBar[];
  onPressDay: (key: string) => void;
  /** The tapped bar: it lifts slightly and the rest fade back, so the chart shows what you picked. */
  selectedKey?: string | null;
  /** Side padding — 0 when the chart sits inside a card that already pads it. */
  inset?: number;
  /** A week of days: the date sits under each weekday, and today's date carries the pill. */
  dates?: boolean;
  /** A short amount over every bar (₹1.9k); the picked bar shows its exact one. Left off at large text. */
  amounts?: boolean;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  // Each day is a capsule in the theme's own tint; the picked day's column rests on a slightly stronger one.
  const track = shade(accent, 94);
  const tray = shade(accent, 95);
  const maxTotal = Math.max(1, ...bars.map((b) => b.totalMinor));
  // The day labels and the today pill have fixed line heights; they grow with the text size so a larger font
  // is not clipped, and the row grows by the same amount so the bars keep their room.
  const { fontScale } = useWindowDimensions();
  const k = Math.min(MAX_FONT_SCALE, Math.max(1, fontScale));
  const labelLine = Math.ceil(15 * k);
  const labelBox = { lineHeight: labelLine, minHeight: labelLine };
  const pillBox = { height: labelLine };
  const showAmounts = amounts && fontScale <= 1.2;
  const amountLine = showAmounts ? Math.ceil(15 * k) : 0;
  const dateLine = dates ? Math.ceil(19 * k) : 0;
  // Column padding, the amount over the capsule, the capsule, the weekday and the date.
  const rowHeight = 8 + (showAmounts ? amountLine + 4 : 0) + MAX_BAR_HEIGHT + 6 + labelLine + dateLine;

  return (
    <View style={[styles.row, { paddingHorizontal: inset, height: rowHeight }]}>
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
              {bar.state === 'outside' ? (
                <View style={[styles.barTrack, styles.trackOutside]}>
                  <View style={styles.outsideDay} />
                </View>
              ) : (
                <View style={[styles.barTrack, { backgroundColor: track, opacity: 0.5 }]} />
              )}
              <Text style={[styles.label, labelBox, styles.labelAway]}>{bar.label}</Text>
              {dates && (
                <Text style={[styles.dateNum, { lineHeight: dateLine - 2 }, styles.labelAway]}>
                  {Number(bar.key.slice(8, 10))}
                </Text>
              )}
            </View>
          );
        }
        return (
          <Pressable
            key={bar.key}
            onPress={() => onPressDay(bar.key)}
            style={[
              styles.col,
              selected && [styles.colOn, { backgroundColor: tray }],
              faded && styles.colFaded,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${bar.key} (${bar.label})${bar.totalMinor > 0 ? `, spent ${formatMoney(bar.totalMinor)}` : ', nothing spent'}`}
          >
            {showAmounts && (
              <Text
                style={[
                  styles.amount,
                  selected && styles.amountOn,
                  { lineHeight: amountLine, height: amountLine },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {bar.totalMinor > 0
                  ? selected
                    ? formatMoney(bar.totalMinor)
                    : compactMoney(bar.totalMinor)
                  : ''}
              </Text>
            )}
            <View style={[styles.barTrack, { backgroundColor: track }]}>
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
              ) : null}
              {selected && !showAmounts && (
                <View style={[styles.bubbleWrap, { bottom: Math.max(barPx, 2) + 6 }]} pointerEvents="none">
                  <View style={[styles.bubble, { backgroundColor: ink }]}>
                    <Text style={styles.bubbleText} numberOfLines={1}>
                      {formatMoney(bar.totalMinor)}
                    </Text>
                    <View style={[styles.bubbleNub, { backgroundColor: ink }]} />
                  </View>
                </View>
              )}
            </View>
            {bar.isCurrent && !dates ? (
              <View style={[styles.todayPill, pillBox, { backgroundColor: accent }]}>
                <Text style={[styles.todayText, { lineHeight: Math.ceil(13 * k) }]}>{bar.label}</Text>
              </View>
            ) : (
              <Text style={[styles.label, labelBox]}>{bar.label}</Text>
            )}
            {dates && (
              <View style={[styles.dateBox, { height: dateLine }]}>
                <Text
                  style={[
                    styles.dateNum,
                    { lineHeight: dateLine - 2 },
                    bar.isCurrent && [styles.dateToday, { backgroundColor: accent }],
                  ]}
                >
                  {Number(bar.key.slice(8, 10))}
                </Text>
              </View>
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
  /** Names this many (the chart's biggest), then an expandable "+N more" control. */
  max?: number;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const itemKey = JSON.stringify(items.map((item) => item.categoryId));
  const expanded = expandedKey === itemKey;
  if (items.length === 0) return null;
  const canExpand = max != null && max > 0 && items.length > max;
  const shown = canExpand && !expanded ? items.slice(0, max) : items;
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
      {canExpand && (
        <Pressable
          style={styles.legendToggle}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show fewer categories' : `Show all ${items.length} categories`}
          accessibilityState={{ expanded }}
          onPress={() => setExpandedKey(expanded ? null : itemKey)}
        >
          <Text style={[styles.legendText, styles.legendMore]}>
            {expanded ? 'Show fewer' : `+${more} more`}
          </Text>
        </Pressable>
      )}
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
  col: {
    width: `${100 / 7.4}%`,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    paddingVertical: 4,
  },
  colFaded: { opacity: 0.4 },
  // The picked day: a soft tray behind its column, under the exact amount.
  colOn: { borderRadius: 14 },
  amount: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginBottom: 4,
  },
  amountOn: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  dateBox: { alignItems: 'center', justifyContent: 'center' },
  dateNum: {
    minWidth: 22,
    paddingHorizontal: 4,
    borderRadius: 7,
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: theme.font.roundedBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  dateToday: { color: theme.colors.ink },
  barTrack: {
    width: '100%',
    maxWidth: 26,
    height: MAX_BAR_HEIGHT,
    borderRadius: 13,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  trackOutside: { alignItems: 'center', justifyContent: 'center' },
  // Fills the capsule from the bottom; the capsule's own corners round it.
  stack: { width: '100%', borderRadius: 4, overflow: 'hidden', flexDirection: 'column-reverse' },
  segment: { width: '100%' },
  outsideDay: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.textMuted,
    opacity: 0.35,
  },
  labelAway: { opacity: 0.45 },
  label: {
    fontFamily: theme.font.body,
    fontSize: 11,
    lineHeight: 15,
    minHeight: 15,
    color: theme.colors.textMuted,
    marginTop: 6,
  },
  todayPill: {
    height: 15,
    marginTop: 6,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRadius: 6,
  },
  todayText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    lineHeight: 13,
    color: theme.colors.textPrimary,
  },
  bubbleWrap: { position: 'absolute', left: -24, right: -24, alignItems: 'center' },
  bubble: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.colors.ink },
  bubbleText: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.surface },
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 4,
    marginTop: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', flexShrink: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 3, flexShrink: 0 },
  legendText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, flexShrink: 1 },
  legendToggle: {
    minHeight: 28,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
  },
  legendMore: { color: theme.colors.textPrimary, fontFamily: theme.font.bodyMedium },
});
