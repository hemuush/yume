import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { timing } from '@/lib/animation';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { hexToRgba } from '@/lib/color';
import { homeInk } from './homeInk';
import { defaultBar, monthBars, weekBars, SpendBar } from './spendBarData';
import Feather from '@expo/vector-icons/Feather';
import { withPressed } from '@/lib/pressed';
import { parseLocalIsoDate } from '@/lib/date';

/** The tallest bar's height; the amount over the selected bar sits above it. */
const MAX_H = 44;
const MIN_H = 6;
/** A day with nothing spent: a thin line, so it doesn't read as a small amount. */
const EMPTY_H = 4;

type Range = 'week' | 'month';

function Bar({
  bar,
  maxMinor,
  ink,
  tint,
  delay,
  animateEntry,
  dateLabel,
  selected,
  onSelect,
  compact,
  embedded,
}: {
  bar: SpendBar;
  maxMinor: number;
  ink: string;
  /** The other days' fill: a soft wash of the theme's ink, so the bars read on the white glass. */
  tint: string;
  delay: number;
  animateEntry: boolean;
  dateLabel: string;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const reduce = useReduceMotion();
  // The hero uses a proportional zero baseline; legacy standalone charts keep their disclosed compression.
  const target = embedded
    ? maxMinor > 0
      ? (Math.max(0, bar.totalMinor) / maxMinor) * 52
      : 0
    : bar.totalMinor > 0 && maxMinor > 0
      ? Math.round(MIN_H + Math.sqrt(bar.totalMinor / maxMinor) * ((compact ? 64 : MAX_H) - MIN_H))
      : EMPTY_H;
  const growth = useSharedValue(reduce || !animateEntry ? 1 : 0);
  useEffect(() => {
    growth.value = reduce || !animateEntry ? 1 : withDelay(delay, withTiming(1, timing(240)));
    return () => cancelAnimation(growth);
  }, [reduce, animateEntry, delay, growth]);
  const selection = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    selection.value = reduce ? Number(selected) : withTiming(Number(selected), timing(160));
    return () => cancelAnimation(selection);
  }, [selected, reduce, selection]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: growth.value }],
  }));
  const selectedStyle = useAnimatedStyle(() => ({ opacity: selection.value }));
  return (
    <Pressable
      style={[styles.col, compact && styles.colFit]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${dateLabel}, ${formatMoney(bar.totalMinor)}`}
    >
      {selected && !compact && (
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {formatMoney(bar.totalMinor)}
        </Text>
      )}
      <Animated.View
        style={[
          styles.bar,
          embedded && styles.slimBar,
          { height: target, transformOrigin: 'bottom', backgroundColor: tint },
          bar.totalMinor === 0 && !selected && styles.barEmpty,
          style,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: ink, borderRadius: embedded ? 4 : 10 },
            selectedStyle,
          ]}
        />
      </Animated.View>
      <View style={styles.dayLabel}>
        <Text style={[styles.label, selected && styles.labelOn]}>{bar.label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Spending as soft glass bars: the last seven days, or this month by week. Today (or this week) is the one
 * dark bar, with its amount on top.
 */
export function SpendBars({
  daily,
  today,
  compact = false,
  embedded = false,
  onSeeInsights,
  periodMode = 'week',
}: {
  daily: { date: string; totalMinor: number }[];
  today: string;
  compact?: boolean;
  embedded?: boolean;
  onSeeInsights?: () => void;
  periodMode?: Range;
}) {
  const chart = useRef<ScrollView>(null);
  const { fontScale } = useWindowDimensions();
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const tint = hexToRgba(accent, 0.55);
  const [chosenRange, setRange] = useState<Range>('week');
  const range = embedded ? periodMode : chosenRange;
  const [switched, setSwitched] = useState(false);
  const [picked, setPicked] = useState<{ range: Range; today: string; key: string } | null>(null);
  const bars = range === 'week' ? weekBars(daily, today) : monthBars(daily, today);
  const selectedKey =
    picked?.range === range && picked.today === today && bars.some((b) => b.key === picked.key)
      ? picked.key
      : defaultBar(bars).key;
  const maxMinor = Math.max(0, ...bars.map((b) => b.totalMinor));
  const total = bars.reduce((s, b) => s + b.totalMinor, 0);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View
          style={{ flex: 1, minWidth: 0 }}
          accessible
          accessibilityLabel={`Spending ${range === 'week' ? 'in the last 7 days' : 'in the selected month'}, ${formatMoney(total)}`}
        >
          <Text style={styles.title}>
            {embedded
              ? range === 'week'
                ? 'Spent · last 7 days'
                : 'Spent · by week'
              : range === 'week'
                ? 'Last 7 days'
                : 'This month'}
            {!compact && (
              <>
                {' '}
                <Text style={styles.total}>{formatMoney(total)}</Text>
              </>
            )}
          </Text>
          {compact && (
            <Text style={[styles.snapshotTotal, embedded && styles.embeddedTotal]}>{formatMoney(total)}</Text>
          )}
        </View>
        {embedded && onSeeInsights && (
          <Pressable
            onPress={onSeeInsights}
            accessibilityRole="button"
            accessibilityLabel="See spending insights"
            style={withPressed(styles.insights)}
          >
            <Text style={styles.insightsText}>Insights</Text>
            <Feather name="arrow-up-right" size={14} color={theme.colors.link} />
          </Pressable>
        )}
        {!embedded && (
          <View style={styles.switch} accessibilityRole="tablist">
            {(['week', 'month'] as const).map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  if (r === range) return;
                  haptics.tap();
                  setSwitched(true);
                  setRange(r);
                  setPicked(null);
                }}
                hitSlop={{ top: 7, bottom: 7, left: 0, right: 0 }}
                style={[styles.seg, r === range && [styles.segOn, { backgroundColor: ink }]]}
                accessibilityRole="tab"
                accessibilityState={{ selected: r === range }}
              >
                <Text style={[styles.segText, r === range && styles.segTextOn]}>
                  {r === 'week' ? 'Week' : 'Month'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <ScrollView
        ref={chart}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.bars,
          compact && styles.barsCompact,
          embedded && styles.barsEmbedded,
          embedded && { height: 88 + 24 * Math.max(0, fontScale - 1) },
        ]}
        onContentSizeChange={() => chart.current?.scrollToEnd({ animated: false })}
      >
        {bars.map((b, i) => (
          <Bar
            key={`${range}:${b.key}`}
            bar={b}
            embedded={embedded}
            compact={compact}
            selected={b.key === selectedKey}
            onSelect={() => {
              haptics.tap();
              setPicked({ range, today, key: b.key });
            }}
            maxMinor={maxMinor}
            ink={ink}
            tint={tint}
            delay={i * 20}
            animateEntry={!switched}
            dateLabel={
              range === 'week'
                ? parseLocalIsoDate(b.key).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                : `Week ${i + 1} of ${parseLocalIsoDate(today).toLocaleDateString(undefined, { month: 'long' })}`
            }
          />
        ))}
      </ScrollView>
      {compact && (
        <View style={[styles.chartFooter, embedded && styles.footerEmbedded]}>
          <Text style={styles.pickedAmount}>
            {range === 'week'
              ? parseLocalIsoDate(selectedKey).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })
              : `Week ${bars.findIndex((b) => b.key === selectedKey) + 1} · ${bars.findIndex((b) => b.key === selectedKey) * 7 + 1}–${Math.min((bars.findIndex((b) => b.key === selectedKey) + 1) * 7, Number(today.slice(8, 10)))} ${parseLocalIsoDate(today).toLocaleDateString(undefined, { month: 'short' })}`}{' '}
            · {formatMoney(bars.find((b) => b.key === selectedKey)?.totalMinor ?? 0)}
          </Text>
        </View>
      )}
      {!embedded && (
        <Text style={styles.scaleHint}>Bar heights are compressed. Tap a bar for its exact amount.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits inside Where it went's card, under its divider.
  wrap: { gap: 6 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  total: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  switch: {
    flexShrink: 0,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
  },
  seg: { minHeight: 44, paddingHorizontal: 12, borderRadius: 13, justifyContent: 'center' },
  segOn: { backgroundColor: theme.colors.white, boxShadow: '0px 1px 3px rgba(18,19,15,0.12)' },
  segText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  segTextOn: { color: theme.colors.white },
  bars: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    // Room for the label, the tallest bar and the amount that rides above the picked one (it was clipped at +34).
    height: MAX_H + 52,
  },
  snapshotTotal: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 26,
    lineHeight: 34,
    color: theme.colors.textPrimary,
    marginTop: 3,
  },
  barsCompact: { height: 112 },
  barsEmbedded: { height: 88 },
  insights: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 8 },
  insightsText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link },
  dayLabel: { minHeight: 24, justifyContent: 'center', paddingHorizontal: 4, borderRadius: 8 },
  embeddedTotal: { fontFamily: theme.font.bodyMedium, fontSize: 15, lineHeight: 20, marginTop: 0 },
  footerEmbedded: { paddingTop: 2, borderTopWidth: 0 },
  chartFooter: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  pickedAmount: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  colFit: { width: 0, minWidth: 0, flexBasis: 0 },
  col: {
    flexGrow: 1,
    width: 44,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    height: '100%',
  },
  bar: { width: '100%', maxWidth: 34, borderRadius: 10 },
  slimBar: { maxWidth: 16, borderRadius: 4 },
  barEmpty: { opacity: 0.6, borderRadius: 2 },
  value: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textPrimary },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  labelOn: { color: theme.colors.textPrimary },
  scaleHint: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textSecondary },
});
