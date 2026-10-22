import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { compactMoney } from '@/lib/compactMoney';
import { haptics } from '@/lib/haptics';
import { timing, PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { hexToRgba } from '@/lib/color';
import { withPressed } from '@/lib/pressed';
import { parseLocalIsoDate } from '@/lib/date';
import { defaultBar, monthBars, weekBars, SpendBar } from './spendBarData';
import { WorkingRow } from './WorkingRow';
import { styles as hero } from './hero.styles';

type Range = 'week' | 'month';

/** The tallest a capsule's fill gets, and the least a day with any spending shows. */
const TRACK_H = 60;
const FILL_MIN = 14;
/** Past this font scale the amounts over the capsules would collide, so only the picked day's is read (above). */
const VALUES_UP_TO = 1.15;
/** A day this many times the daily goal is a one-off, not a slip: said calmly. */
const BIG_DAY_FACTOR = 4;

/** A capsule's fill height: the square root keeps small days visible beside a very large one. */
function fillHeight(minor: number, maxMinor: number): number {
  if (minor <= 0 || maxMinor <= 0) return 0;
  return FILL_MIN + Math.sqrt(minor / maxMinor) * (TRACK_H - FILL_MIN);
}

function Capsule({
  bar,
  maxMinor,
  goalMinor,
  showValue,
  delay,
  dateLabel,
  selected,
  onSelect,
}: {
  bar: SpendBar;
  maxMinor: number;
  goalMinor: number | null;
  showValue: boolean;
  delay: number;
  dateLabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const reduce = useReduceMotion();
  const { accent, secondary } = useAccent();
  const target = fillHeight(bar.totalMinor, maxMinor);
  const growth = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    growth.value = reduce ? 1 : withDelay(delay, withTiming(1, timing(320)));
    return () => cancelAnimation(growth);
  }, [reduce, delay, growth]);
  const height = useSharedValue(target);
  useEffect(() => {
    height.value = reduce ? target : withTiming(target, timing(240));
    return () => cancelAnimation(height);
  }, [target, reduce, height]);
  const fillStyle = useAnimatedStyle(() => ({
    height: height.value,
    transform: [{ scaleY: growth.value }],
  }));
  const goalH = goalMinor != null && goalMinor > 0 ? fillHeight(goalMinor, maxMinor) : null;
  return (
    <Pressable
      style={styles.col}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${dateLabel}, ${formatMoney(bar.totalMinor)}`}
    >
      <Text style={[styles.value, selected && styles.valueOn]} numberOfLines={1}>
        {showValue ? (bar.totalMinor > 0 ? compactMoney(bar.totalMinor) : '–') : ' '}
      </Text>
      <View style={[styles.track, { backgroundColor: hexToRgba(accent, 0.2) }, selected && styles.trackOn]}>
        <Animated.View style={[styles.fill, { height: target, transformOrigin: 'bottom' }, fillStyle]}>
          <LinearGradient colors={[accent, secondary]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {goalH != null && <View pointerEvents="none" style={[styles.goalTick, { bottom: goalH }]} />}
      </View>
      <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
        {bar.label}
      </Text>
    </Pressable>
  );
}

/** What the picked day was against the daily goal, in one short chip. */
function dayChip(spent: number, goal: number | null): { text: string; tone: 'ok' | 'warn' | 'plain' } | null {
  if (spent <= 0) return { text: 'No spending', tone: 'ok' };
  if (goal == null || goal <= 0) return null;
  if (spent > goal * BIG_DAY_FACTOR) return { text: 'A big day', tone: 'warn' };
  if (spent > goal) return { text: `${formatMoney(spent - goal)} over`, tone: 'warn' };
  return { text: `${formatMoney(goal - spent)} left`, tone: 'plain' };
}

/**
 * Home's spending week (or, in a past month, its weeks) as soft capsules in the theme's two colours: each
 * with its amount, empty days still visible as empty capsules, and a tick on every capsule at the daily goal.
 * The row above reads the picked day (it starts on today) against the goal; tapping it, when there is a goal,
 * opens how the allowance works.
 */
export function SpendBars({
  daily,
  today,
  onSeeInsights,
  periodMode: range = 'week',
  goalMinor = null,
  todaySpentMinor = null,
}: {
  daily: { date: string; totalMinor: number }[];
  today: string;
  onSeeInsights?: () => void;
  periodMode?: Range;
  /** The daily goal, when one is set and the current period is showing. */
  goalMinor?: number | null;
  /** Today's outgoing spend, which refunds never refill: it is what today is held against the goal by. */
  todaySpentMinor?: number | null;
}) {
  const { fontScale } = useWindowDimensions();
  const [picked, setPicked] = useState<{
    range: Range;
    today: string;
    key: string;
    daily: typeof daily;
  } | null>(null);
  const [showWorking, setShowWorking] = useState(false);
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
  const goal = range === 'week' ? goalMinor : null;
  const maxMinor = Math.max(0, goal ?? 0, ...bars.map((b) => b.totalMinor));
  const selectedIndex = bars.findIndex((bar) => bar.key === selectedKey);
  const selectedBar = bars[selectedIndex];
  const isToday = range === 'week' && selectedKey === today;
  // Today is held to the goal by what went out (refunds never refill it); other days by their own total.
  const selectedSpent = isToday && todaySpentMinor != null ? todaySpentMinor : (selectedBar?.totalMinor ?? 0);
  const chip = range === 'week' ? dayChip(selectedSpent, goal) : null;
  const title =
    range === 'week'
      ? isToday
        ? 'Today'
        : parseLocalIsoDate(selectedKey).toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
      : `Week ${selectedIndex + 1} · ${selectedIndex * 7 + 1}–${Math.min((selectedIndex + 1) * 7, Number(today.slice(8, 10)))} ${parseLocalIsoDate(today).toLocaleDateString(undefined, { month: 'short' })}`;
  const explains = goal != null && isToday;
  const dayRow = (
    <View style={styles.dayRow}>
      <Text style={styles.dayTitle}>{title}</Text>
      <Text style={styles.dayAmount}>{formatMoney(selectedSpent)}</Text>
      {chip && (
        <View
          style={[styles.chip, chip.tone === 'ok' && styles.chipOk, chip.tone === 'warn' && styles.chipWarn]}
        >
          <Text
            style={[
              styles.chipText,
              chip.tone === 'ok' && { color: theme.colors.incomeText },
              chip.tone === 'warn' && { color: theme.colors.warnInk },
            ]}
          >
            {chip.text}
          </Text>
        </View>
      )}
    </View>
  );
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {explains ? (
          <Pressable
            style={withPressed(styles.headMain)}
            onPress={() => setShowWorking((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="How today’s allowance is calculated"
            accessibilityState={{ expanded: showWorking }}
          >
            {dayRow}
          </Pressable>
        ) : (
          <View
            style={styles.headMain}
            accessible
            accessibilityLabel={`${title}, ${formatMoney(selectedSpent)}`}
          >
            {dayRow}
          </View>
        )}
        {onSeeInsights && (
          <Pressable
            onPress={onSeeInsights}
            accessibilityRole="button"
            accessibilityLabel="See spending insights"
            style={withPressed(styles.insights)}
          >
            <Text style={styles.insightsText}>Insights</Text>
            <Feather name="chevron-right" size={14} color={theme.colors.link} />
          </Pressable>
        )}
      </View>
      {showWorking && explains && goal != null && (
        <Animated.View entering={PANEL_ENTER} exiting={ROW_EXIT} style={hero.working}>
          <WorkingRow label="Daily limit" value={formatMoney(goal)} />
          <WorkingRow label="Expenses today" value={formatMoney(selectedSpent)} />
          <Text style={styles.note}>
            Refunds and income do not refill your daily limit. Transfers are excluded.
          </Text>
        </Animated.View>
      )}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.bars, { height: 112 + 28 * Math.max(0, fontScale - 1) }]}
      >
        {bars.map((b, i) => (
          <Capsule
            key={`${range}:${b.key}`}
            bar={b}
            selected={b.key === selectedKey}
            onSelect={() => {
              if (b.key === selectedKey) return;
              haptics.tap();
              setPicked({ range, today, key: b.key, daily });
            }}
            maxMinor={maxMinor}
            goalMinor={goal}
            showValue={fontScale <= VALUES_UP_TO}
            delay={i * 45}
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
      </Animated.View>
      {goal != null && (
        <View
          style={styles.goalKey}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.goalSwatch} />
          <Text style={styles.goalText}>Daily goal {compactMoney(goal)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 2 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  headMain: { flexShrink: 1, minHeight: 44, justifyContent: 'center' },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  dayTitle: {
    fontFamily: theme.font.roundedBold,
    fontSize: theme.typeSize.section,
    color: theme.colors.textPrimary,
  },
  dayAmount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chip: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.tray,
  },
  chipOk: { backgroundColor: theme.colors.incomeTint },
  chipWarn: { backgroundColor: theme.colors.dueTint },
  chipText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  insights: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  insightsText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link },
  note: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
    paddingBottom: 6,
  },
  bars: { flexDirection: 'row', gap: 6, paddingTop: 2, paddingBottom: 2 },
  col: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  value: {
    minHeight: 14,
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  valueOn: { color: theme.colors.textPrimary },
  track: {
    flex: 1,
    width: '100%',
    maxWidth: 28,
    minHeight: TRACK_H,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  trackOn: { borderColor: 'rgba(18,19,15,0.22)' },
  fill: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  goalTick: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(18,19,15,0.35)',
  },
  label: { minHeight: 16, fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  labelOn: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  goalKey: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2, paddingBottom: 4 },
  goalSwatch: {
    width: 14,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(18,19,15,0.35)',
  },
  goalText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
});
