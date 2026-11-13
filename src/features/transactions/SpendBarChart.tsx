import { useEffect, useRef, useState } from 'react';
import { DURATIONS, EASE_OUT } from '@/lib/motionTimings';
import { View, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Text, MAX_FONT_SCALE } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { formatMoney } from '@/lib/money';
import type { SpendBar } from './spendChart';

import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { shade } from '@/lib/color';

const MAX_BAR_HEIGHT = 52;
// A day with any spend is at least this tall, so a small one still reads as a bar.
const MIN_BAR_HEIGHT = 6;
/** Height kept over the bars for the picked day's amount bubble. */
const BUBBLE_ROOM = 22;

/** How tall a day's bar is, in dp: a day with spend is at least MIN_BAR_HEIGHT; no spend, no bar. */
function barHeight(totalMinor: number, maxTotal: number) {
  return totalMinor > 0 ? Math.max(MIN_BAR_HEIGHT, (totalMinor / maxTotal) * MAX_BAR_HEIGHT) : 0;
}

/**
 * One bar's stack: shown at its height at once (nothing draws up from empty, or one after another: the calm rule),
 * then glides to a new height when the value really changes. Core `Animated`, not Reanimated: this chart is in the
 * Insights sheet, a Modal window.
 */
function AnimatedBarStack({
  heightPct,
  style,
  children,
}: {
  heightPct: number;
  style: React.ComponentProps<typeof Animated.View>['style'];
  children: React.ReactNode;
}) {
  const reduce = useReduceMotion();
  // The height itself, in percent: already where it belongs on first showing.
  const [v] = useState(() => new Animated.Value(heightPct));
  const shown = useRef(heightPct);

  useEffect(() => {
    if (reduce) {
      shown.current = heightPct;
      v.setValue(heightPct);
      return;
    }
    // Nothing to do on first showing, or when the height is unchanged.
    if (shown.current === heightPct) return;
    shown.current = heightPct;
    const anim = Animated.timing(v, {
      toValue: heightPct,
      duration: DURATIONS.standard,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    // Stopped when the bar goes or its height changes again, so no frame runs for a bar that has left.
    return () => anim.stop();
  }, [heightPct, reduce, v]);

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
  averageMinor = null,
}: {
  bars: SpendBar[];
  onPressDay: (key: string) => void;
  /** The tapped bar: it turns to the theme's ink and shows its exact amount; the rest stay in a soft tint. */
  selectedKey?: string | null;
  /** Side padding — 0 when the chart sits inside a card that already pads it. */
  inset?: number;
  /** A week of days: the date sits under each weekday. */
  dates?: boolean;
  /** The average spent a bar so far (a day, or a week in Month): a dashed line across the chart, named at its right end. */
  averageMinor?: number | null;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  // One colour for every day, so the chart reads as shape; the picked day is the one dark bar.
  const track = shade(accent, 94);
  const fill = shade(accent, 75);
  const maxTotal = Math.max(1, ...bars.map((b) => b.totalMinor));
  // The day labels have fixed line heights; they grow with the text size so a larger font is not clipped,
  // and the row grows by the same amount so the bars keep their room.
  const { fontScale } = useWindowDimensions();
  const k = Math.min(MAX_FONT_SCALE, Math.max(1, fontScale));
  const labelLine = Math.ceil(15 * k);
  const labelBox = { lineHeight: labelLine, minHeight: labelLine };
  const dateLine = dates ? Math.ceil(19 * k) : 0;
  // Column padding, room for the picked day's amount (it grows with the text), the capsule, the weekday and the date.
  const rowHeight = 8 + Math.ceil(BUBBLE_ROOM * k) + MAX_BAR_HEIGHT + 6 + labelLine + dateLine;
  // Where the capsules rest: column padding, the gap and the weekday and date lines under them.
  const baseline = 4 + 6 + labelLine + dateLine;
  const picked = bars.find((b) => !b.state && b.key === selectedKey);
  const showAverage = averageMinor != null && averageMinor > 0 && averageMinor <= maxTotal;
  const averageBottom = showAverage ? baseline + (averageMinor / maxTotal) * MAX_BAR_HEIGHT : 0;
  const bubbleBottom = picked ? baseline + Math.max(barHeight(picked.totalMinor, maxTotal), 2) + 6 : 0;
  // The average's name sits at the line's right end, about three columns wide; a picked day over there, at that
  // height, has its amount drawn on top of it, so the name steps aside until another day is picked (the line stays).
  // shortcut: "the last three columns" is the name's place, not a measured overlap of the words.
  const fromEnd = picked ? bars.length - bars.indexOf(picked) : 0;
  const nameClash =
    fromEnd > 0 &&
    fromEnd <= 3 &&
    bubbleBottom - 3 < averageBottom + 16 &&
    bubbleBottom + Math.ceil(22 * k) > averageBottom;

  return (
    <View style={[styles.row, { paddingHorizontal: inset, height: rowHeight }]}>
      {showAverage && (
        // The dashed line runs behind the capsules; its name is drawn after them (below), so a capsule never
        // paints over the words.
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.average, { bottom: averageBottom, left: inset, right: inset }]}
        />
      )}
      {bars.map((bar) => {
        const barPx = barHeight(bar.totalMinor, maxTotal);
        const heightPct = (barPx / MAX_BAR_HEIGHT) * 100;
        const selected = selectedKey === bar.key;
        if (bar.state) {
          // Not a day of this week's month, or not here yet: a small quiet dot, never tappable.
          return (
            <View key={bar.key} style={styles.col} accessibilityElementsHidden importantForAccessibility="no">
              <View style={[styles.barTrack, styles.trackOutside]}>
                <View style={styles.outsideDay} />
              </View>
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
            style={styles.col}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${bar.key} (${bar.label})${bar.totalMinor > 0 ? `, spent ${formatMoney(bar.totalMinor)}` : ', nothing spent'}`}
          >
            <View style={[styles.barTrack, { backgroundColor: track }]}>
              {bar.totalMinor > 0 ? (
                <AnimatedBarStack
                  heightPct={heightPct}
                  style={[styles.stack, { backgroundColor: selected ? ink : fill }]}
                >
                  {null}
                </AnimatedBarStack>
              ) : null}
            </View>
            <Text
              style={[styles.label, labelBox, bar.isCurrent && styles.labelToday, selected && styles.labelOn]}
            >
              {bar.label}
            </Text>
            {dates && (
              <View style={[styles.dateBox, { height: dateLine }]}>
                <Text style={[styles.dateNum, { lineHeight: dateLine - 2 }, selected && styles.labelOn]}>
                  {Number(bar.key.slice(8, 10))}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
      {showAverage && !nameClash && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.averageLabel, { bottom: averageBottom, left: inset, right: inset }]}
        >
          <Text style={styles.averageText}>
            avg {formatMoney(averageMinor!)} {dates ? 'a day' : 'a week'}
          </Text>
        </View>
      )}
      {picked && (
        // The picked day's amount, drawn last on a row laid out like the columns: it is not cut by the capsule (which
        // clips its children to 26 dp and its own height), and it stays over the next capsules and the average's name.
        <View pointerEvents="none" style={[styles.bubbleRow, { paddingHorizontal: inset }]}>
          {bars.map((bar) => (
            <View key={bar.key} style={styles.bubbleCol}>
              {bar === picked && (
                <View style={[styles.bubbleWrap, { bottom: bubbleBottom }]}>
                  <View style={[styles.bubble, { backgroundColor: ink }]}>
                    <Text style={styles.bubbleText} numberOfLines={1}>
                      {formatMoney(bar.totalMinor)}
                    </Text>
                    <View style={[styles.bubbleNub, { backgroundColor: ink }]} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
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
  stack: { width: '100%', borderRadius: 13 },
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
  // Over the whole row, its columns the same width and spacing as the bars' own.
  bubbleRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bubbleCol: { width: `${100 / 7.4}%`, height: '100%' },
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
  average: {
    position: 'absolute',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.inkOff,
  },
  // Sits on the line's right end, above the capsules.
  averageLabel: { position: 'absolute', alignItems: 'flex-end' },
  averageText: {
    marginTop: -16,
    paddingLeft: 4,
    fontFamily: theme.font.body,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
    fontVariant: ['tabular-nums'],
  },
  labelToday: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  labelOn: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});
