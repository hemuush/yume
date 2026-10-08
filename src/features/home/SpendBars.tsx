import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { Glass, GLASS } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { timing } from '@/lib/animation';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from './homeInk';
import { monthBars, weekBars, SpendBar } from './spendBars';

/** The tallest bar's height; the amount over today's bar sits above it. */
const MAX_H = 84;
const MIN_H = 10;

type Range = 'week' | 'month';

function Bar({ bar, maxMinor, ink, delay }: { bar: SpendBar; maxMinor: number; ink: string; delay: number }) {
  const reduce = useReduceMotion();
  const target = maxMinor > 0 ? Math.max(MIN_H, Math.round((bar.totalMinor / maxMinor) * MAX_H)) : MIN_H;
  const h = useSharedValue(reduce ? target : MIN_H);
  useEffect(() => {
    h.value = reduce ? target : withDelay(delay, withTiming(target, timing(520)));
  }, [target, reduce, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={styles.col}>
      {bar.current && (
        <Text style={styles.value} numberOfLines={1}>
          {formatMoney(bar.totalMinor)}
        </Text>
      )}
      <Animated.View style={[styles.bar, bar.current && { backgroundColor: ink, borderColor: ink }, style]} />
      <Text style={[styles.label, bar.current && styles.labelOn]}>{bar.label}</Text>
    </View>
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
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const [range, setRange] = useState<Range>('week');
  const bars = range === 'week' ? weekBars(daily, today) : monthBars(daily, today);
  const maxMinor = Math.max(0, ...bars.map((b) => b.totalMinor));
  const total = bars.reduce((s, b) => s + b.totalMinor, 0);

  return (
    <Glass radius={24} style={styles.card}>
      <View style={styles.head}>
        <View
          accessible
          accessibilityLabel={`Spending ${range === 'week' ? 'in the last 7 days' : 'this month'}, ${formatMoney(total)}`}
        >
          <Text style={styles.title}>Spending</Text>
          <Text style={styles.total}>
            {formatMoney(total)} {range === 'week' ? 'in 7 days' : 'this month'}
          </Text>
        </View>
        <View style={styles.switch} accessibilityRole="tablist">
          {(['week', 'month'] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => {
                if (r === range) return;
                haptics.tap();
                setRange(r);
              }}
              hitSlop={4}
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
      <View style={styles.bars}>
        {bars.map((b, i) => (
          <Bar key={`${range}:${b.key}`} bar={b} maxMinor={maxMinor} ink={ink} delay={i * 35} />
        ))}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  total: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted, marginTop: 2 },
  switch: {
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
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: MAX_H + 44, marginTop: 8 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' },
  bar: {
    width: '100%',
    maxWidth: 34,
    borderRadius: 12,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  value: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textPrimary },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  labelOn: { color: theme.colors.textPrimary },
});
