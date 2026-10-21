import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ScrollViewInstance,
} from 'react-native';
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
import { themeInk } from '@/theme/interactionColors';
import { defaultBar, monthBars, weekBars, SpendBar } from './spendBarData';
import Feather from '@expo/vector-icons/Feather';
import { withPressed } from '@/lib/pressed';
import { parseLocalIsoDate } from '@/lib/date';

type Range = 'week' | 'month';

function Bar({
  bar,
  maxMinor,
  ink,
  tint,
  delay,
  dateLabel,
  selected,
  onSelect,
}: {
  bar: SpendBar;
  maxMinor: number;
  ink: string;
  /** The other days' fill follows the selected theme's accent. */
  tint: string;
  delay: number;
  dateLabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const reduce = useReduceMotion();
  const target = maxMinor > 0 ? (Math.max(0, bar.totalMinor) / maxMinor) * 52 : 0;
  const growth = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    growth.value = reduce ? 1 : withDelay(delay, withTiming(1, timing(240)));
    return () => cancelAnimation(growth);
  }, [reduce, delay, growth]);
  const selection = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    selection.value = reduce ? Number(selected) : withTiming(Number(selected), timing(160));
    return () => cancelAnimation(selection);
  }, [selected, reduce, selection]);
  const height = useSharedValue(target);
  useEffect(() => {
    height.value = reduce ? target : withTiming(target, timing(180));
    return () => cancelAnimation(height);
  }, [target, reduce, height]);
  const style = useAnimatedStyle(() => ({
    height: height.value,
    transform: [{ scaleY: growth.value }],
  }));
  const selectedStyle = useAnimatedStyle(() => ({ opacity: selection.value }));
  return (
    <Pressable
      style={styles.col}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${dateLabel}, ${formatMoney(bar.totalMinor)}`}
    >
      <Animated.View
        style={[
          styles.bar,
          { height: target, transformOrigin: 'bottom', backgroundColor: tint },
          bar.totalMinor === 0 && !selected && styles.barEmpty,
          style,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: ink, borderRadius: 4 }, selectedStyle]}
        />
      </Animated.View>
      <View style={styles.dayLabel}>
        <Text style={[styles.label, selected && styles.labelOn]}>{bar.label}</Text>
      </View>
    </Pressable>
  );
}

/** Interactive spending chart in Home's hero: daily or weekly, with proportional heights. */
export function SpendBars({
  daily,
  today,
  onSeeInsights,
  periodMode: range = 'week',
}: {
  daily: { date: string; totalMinor: number }[];
  today: string;
  onSeeInsights?: () => void;
  periodMode?: Range;
}) {
  const chart = useRef<ScrollViewInstance>(null);
  const { fontScale } = useWindowDimensions();
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const tint = hexToRgba(accent, 0.55);
  const [picked, setPicked] = useState<{
    range: Range;
    today: string;
    key: string;
    daily: typeof daily;
  } | null>(null);
  const bars = useMemo(
    () => (range === 'week' ? weekBars(daily, today) : monthBars(daily, today)),
    [daily, today, range]
  );
  const selectedKey =
    picked?.range === range &&
    picked.today === today &&
    picked.daily === daily &&
    bars.some((b) => b.key === picked.key)
      ? picked.key
      : defaultBar(bars).key;
  const maxMinor = Math.max(0, ...bars.map((b) => b.totalMinor));
  const total = bars.reduce((s, b) => s + b.totalMinor, 0);
  const selectedIndex = bars.findIndex((bar) => bar.key === selectedKey);
  const selectedBar = bars[selectedIndex];
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View
          style={{ flex: 1, minWidth: 0 }}
          accessible
          accessibilityLabel={`Spending ${range === 'week' ? 'in the last 7 days' : 'in the selected month'}, ${formatMoney(total)}`}
        >
          <Text style={styles.title}>{range === 'week' ? 'Spent · last 7 days' : 'Spent · by week'}</Text>
          <Text style={styles.snapshotTotal}>{formatMoney(total)}</Text>
        </View>
        {onSeeInsights && (
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
      </View>
      <ScrollView
        ref={chart}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.bars, { height: 88 + 24 * Math.max(0, fontScale - 1) }]}
        onContentSizeChange={() => chart.current?.scrollToEnd({ animated: false })}
      >
        {bars.map((b, i) => (
          <Bar
            key={`${range}:${b.key}`}
            bar={b}
            selected={b.key === selectedKey}
            onSelect={() => {
              if (b.key === selectedKey) return;
              haptics.tap();
              setPicked({ range, today, key: b.key, daily });
            }}
            maxMinor={maxMinor}
            ink={ink}
            tint={tint}
            delay={i * 20}
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
      <View style={styles.chartFooter}>
        <Text style={styles.pickedAmount}>
          {range === 'week' && selectedKey === today ? 'Today · ' : ''}
          {range === 'week'
            ? parseLocalIsoDate(selectedKey).toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })
            : `Week ${selectedIndex + 1} · ${selectedIndex * 7 + 1}–${Math.min((selectedIndex + 1) * 7, Number(today.slice(8, 10)))} ${parseLocalIsoDate(today).toLocaleDateString(undefined, { month: 'short' })}`}{' '}
          · {formatMoney(selectedBar?.totalMinor ?? 0)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fits inside the existing Home hero.
  wrap: { gap: 6 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  bars: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  snapshotTotal: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 0,
    color: theme.colors.textPrimary,
  },
  insights: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 8 },
  insightsText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link },
  dayLabel: { minHeight: 24, justifyContent: 'center', paddingHorizontal: 4, borderRadius: 8 },
  chartFooter: { paddingTop: 2 },
  pickedAmount: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  col: {
    flexGrow: 1,
    width: 0,
    minWidth: 0,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    height: '100%',
  },
  bar: { width: '100%', maxWidth: 16, borderRadius: 4 },
  barEmpty: { opacity: 0.6, borderRadius: 2 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  labelOn: { color: theme.colors.textPrimary },
});
