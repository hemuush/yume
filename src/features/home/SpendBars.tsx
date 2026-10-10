import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { timing } from '@/lib/animation';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { hexToRgba } from '@/lib/color';
import { homeInk } from './homeInk';
import { monthBars, weekBars, SpendBar } from './spendBarData';
import { parseLocalIsoDate } from '@/lib/date';

/** The tallest bar's height; the amount over today's bar sits above it. */
const MAX_H = 84;
const MIN_H = 8;
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
}) {
  const reduce = useReduceMotion();
  const target =
    bar.totalMinor > 0 && maxMinor > 0
      ? Math.max(MIN_H, Math.round((bar.totalMinor / maxMinor) * MAX_H))
      : EMPTY_H;
  const growth = useSharedValue(reduce || !animateEntry ? 1 : 0);
  useEffect(() => {
    growth.value = reduce || !animateEntry ? 1 : withDelay(delay, withTiming(1, timing(240)));
    return () => cancelAnimation(growth);
  }, [reduce, animateEntry, delay, growth]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: growth.value }] }));
  return (
    <Pressable
      style={styles.col}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${dateLabel}, ${formatMoney(bar.totalMinor)}`}
    >
      {selected && (
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {formatMoney(bar.totalMinor)}
        </Text>
      )}
      <Animated.View
        style={[
          styles.bar,
          { height: target, transformOrigin: 'bottom', backgroundColor: selected ? ink : tint },
          bar.totalMinor === 0 && !selected && styles.barEmpty,
          style,
        ]}
      />
      <Text style={[styles.label, selected && styles.labelOn]}>{bar.label}</Text>
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
}: {
  daily: { date: string; totalMinor: number }[];
  today: string;
}) {
  const chart = useRef<ScrollView>(null);
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const tint = hexToRgba(ink, 0.22);
  const [range, setRange] = useState<Range>('week');
  const [switched, setSwitched] = useState(false);
  const [picked, setPicked] = useState<{ range: Range; today: string; key: string } | null>(null);
  const bars = range === 'week' ? weekBars(daily, today) : monthBars(daily, today);
  const selectedKey =
    picked?.range === range && picked.today === today && bars.some((b) => b.key === picked.key)
      ? picked.key
      : bars[bars.length - 1].key;
  const selectedBar = bars.find((b) => b.key === selectedKey)!;
  const selectedIndex = bars.indexOf(selectedBar);
  const selectedDate =
    range === 'week'
      ? parseLocalIsoDate(selectedBar.key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      : `${selectedIndex * 7 + 1}–${Math.min((selectedIndex + 1) * 7, Number(today.slice(8)))} ${parseLocalIsoDate(today).toLocaleDateString(undefined, { month: 'short' })}`;
  const maxMinor = Math.max(0, ...bars.map((b) => b.totalMinor));
  const total = bars.reduce((s, b) => s + b.totalMinor, 0);
  const rangeDates =
    range === 'week'
      ? `${parseLocalIsoDate(bars[0].key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}–${parseLocalIsoDate(today).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
      : `1–${Number(today.slice(8))} ${parseLocalIsoDate(today).toLocaleDateString(undefined, { month: 'short' })}`;

  return (
    <Glass radius={24} style={styles.card}>
      <View style={styles.head}>
        <View
          style={{ flex: 1, minWidth: 0 }}
          accessible
          accessibilityLabel={`Spending ${range === 'week' ? 'in the last 7 days' : 'this month'}, ${formatMoney(total)}`}
        >
          <Text style={styles.title}>Spending</Text>
          <Text style={styles.total}>
            {formatMoney(total)} {range === 'week' ? 'in 7 days' : 'this month'} · {rangeDates}
          </Text>
        </View>
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
              hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
              style={[styles.seg, r === range && styles.segOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: r === range }}
            >
              <Text style={[styles.segText, r === range && styles.segTextOn]}>
                {r === 'week' ? 'Week' : 'Month'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        ref={chart}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bars}
        onContentSizeChange={() => chart.current?.scrollToEnd({ animated: false })}
      >
        {bars.map((b, i) => (
          <Bar
            key={`${range}:${b.key}`}
            bar={b}
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
      <Text accessibilityLiveRegion="polite" style={styles.readout}>
        {selectedDate} · {formatMoney(selectedBar.totalMinor)}
      </Text>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  total: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted, marginTop: 2 },
  switch: {
    flexShrink: 0,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 16,
    backgroundColor: 'rgba(18,19,15,0.05)',
  },
  seg: { minHeight: 26, paddingHorizontal: 12, borderRadius: 13, justifyContent: 'center' },
  segOn: { backgroundColor: theme.colors.white, boxShadow: '0px 1px 3px rgba(18,19,15,0.12)' },
  segText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  segTextOn: { color: theme.colors.textPrimary },
  readout: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  bars: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: MAX_H + 44,
    marginTop: 8,
  },
  col: {
    flexGrow: 1,
    width: 44,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    height: '100%',
  },
  bar: { width: '100%', maxWidth: 34, borderRadius: 10 },
  barEmpty: { opacity: 0.6, borderRadius: 2 },
  value: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textPrimary },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  labelOn: { color: theme.colors.textPrimary },
});
