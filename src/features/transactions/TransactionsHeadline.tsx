import { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { SpendBarChart, ChartLegend } from './SpendBarChart';
import { SpendBar, ChartLegendItem } from './spendChart';
import { styles } from './transactions.styles';
import { DURATIONS } from '@/lib/motionTimings';
import { withPressed } from '@/lib/pressed';

const VIEW_SCOPES: { label: string; value: 'week' | 'month' }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

/** How many categories the legend names before "+N more". */
const LEGEND_MAX = 4;

interface HeadlineContent {
  expenseMinor: number;
  incomeMinor: number;
  /** This period's spend less the comparison period's; null when there is nothing to compare. */
  expenseChangeMinor: number | null;
  viewScope: 'week' | 'month';
  /** What the change pill compares with; defaults to "last week"/"last month". */
  compareLabel?: string;
  bars: SpendBar[];
  legend: ChartLegendItem[];
}

/**
 * The big "spent this week/month" figure plus the bar chart beneath it —
 * already animates in place (`CountUpAmount` eases between values,
 * `SpendBarChart`'s own bars grow to their new height), but a swipe or a
 * chevron tap just cut straight to those new values with no sense of
 * direction. Since this screen already has a real drag gesture
 * (`useSwipeStep`) for stepping period, this brings the exact same
 * lagged-state slide `ThisMonthHero.tsx` uses for Home's month switch —
 * same technique, same timing — so the content visibly follows the
 * direction of the step instead of only reacting to it afterward.
 *
 * `periodKey` identifies the period showing and `direction` says which way
 * it just moved (+1 forward, -1 back, 0 for a scope toggle or a picked
 * month, where a crossfade reads better than a guessed slide direction) —
 * same contract as ThisMonthHero's own props.
 */
export function TransactionsHeadline({
  periodKey,
  direction,
  expenseMinor,
  incomeMinor,
  expenseChangeMinor,
  viewScope,
  compareLabel,
  onChangeViewScope,
  bars,
  legend,
  onPressDay,
  selectedKey,
}: HeadlineContent & {
  periodKey: string;
  direction: -1 | 0 | 1;
  /** The Week/Month switch, in the card's corner beside the figure it changes. */
  onChangeViewScope: (scope: 'week' | 'month') => void;
  onPressDay: (key: string) => void;
  /** The tapped bar, if any — see SpendBarChart's `selectedKey`. */
  selectedKey: string | null;
}) {
  const reduce = useReduceMotion();
  const [displayed, setDisplayed] = useState<HeadlineContent>({
    expenseMinor,
    incomeMinor,
    expenseChangeMinor,
    viewScope,
    compareLabel,
    bars,
    legend,
  });
  // See ThisMonthHero.tsx's identical ref/effect for the full story: gating
  // this solely on `[periodKey]` (skipping the first run) was a real bug —
  // `displayed` seeded from whatever `expenseMinor` was at first render
  // (before the real data had loaded) would never update again, since data
  // finishing its load doesn't change `periodKey`. Comparing against the
  // periodKey this effect last actually ran for, instead, means a same-period
  // data update syncs immediately (no slide) while a genuine period change
  // still turns the page.
  const prevPeriodKey = useRef(periodKey);
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  // Bumped once per effect run below — lets a delayed slide-out callback
  // recognize it's been superseded (see the race `commit` guards against,
  // right below) instead of blindly applying a stale snapshot.
  const runId = useRef(0);

  useEffect(() => {
    const myRun = ++runId.current;
    const next: HeadlineContent = {
      expenseMinor,
      incomeMinor,
      expenseChangeMinor,
      viewScope,
      compareLabel,
      bars,
      legend,
    };
    const isPeriodTurn = prevPeriodKey.current !== periodKey;
    prevPeriodKey.current = periodKey;

    if (!isPeriodTurn || reduce) {
      setDisplayed(next);
      return;
    }
    const outX = direction > 0 ? -18 : direction < 0 ? 18 : 0;
    const inX = direction > 0 ? 18 : direction < 0 ? -18 : 0;
    // `anchor`/period changing and the new period's transactions finishing
    // their reload are two separate state updates — the period flips a
    // render before the reload resolves, so `bars` here can be a
    // transitional snapshot: built from the *new* period's date range but
    // the *old* period's still-loaded transactions, so every bucket reads 0
    // (none of last period's rows fall in the new range). That's fine
    // normally — the subsequent effect run once real data lands sees
    // `isPeriodTurn` already false and applies the correct bars immediately
    // via the branch above. The bug this guards against is that fix racing
    // a *slower* path: this run's own delayed callback below, still
    // scheduled from when the period first changed, firing afterward and
    // clobbering that correct update with the all-zero bars it captured
    // back then. `commit` only applies `next` if no later effect run has
    // happened since — otherwise it's dropped instead of overwriting the
    // real data that already landed, which was this bug's actual symptom:
    // the bar chart going empty after navigating to a different period.
    const commit = () => {
      if (runId.current !== myRun) return;
      setDisplayed(next);
    };
    opacity.value = withTiming(0, { duration: DURATIONS.slideOut });
    tx.value = withTiming(outX, { duration: DURATIONS.slideOut }, (finished) => {
      if (!finished) return;
      runOnJS(commit)();
      tx.value = inX;
      tx.value = withTiming(0, { duration: DURATIONS.slideIn });
      opacity.value = withTiming(1, { duration: DURATIONS.slideIn });
    });
    // `direction` is read with the period it came with, and `opacity`/`tx` are
    // stable shared values; re-running on `direction` alone would replay the slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    periodKey,
    expenseMinor,
    incomeMinor,
    expenseChangeMinor,
    viewScope,
    compareLabel,
    bars,
    legend,
    reduce,
  ]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  const net = displayed.incomeMinor - displayed.expenseMinor;
  const change = displayed.expenseChangeMinor;
  return (
    <View style={styles.sumCard}>
      {/* Outside the slide: the switch is a control, and it shouldn't move under your finger. */}
      <View style={styles.scopeSwitch} accessibilityRole="radiogroup">
        {VIEW_SCOPES.map((o) => {
          const on = viewScope === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChangeViewScope(o.value)}
              style={withPressed([styles.scopeBtn, on && styles.scopeBtnOn])}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.scopeText, on && styles.scopeTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ReanimatedAnimated.View style={slideStyle}>
        <Text style={styles.sumKicker}>Spent</Text>
        <CountUpAmount
          minor={displayed.expenseMinor}
          style={styles.headlineAmt}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        {change != null && change !== 0 && (
          <View style={[styles.changePill, change > 0 ? styles.changePillUp : styles.changePillDown]}>
            <Text style={[styles.changeText, change > 0 ? styles.expense : styles.income]}>
              {change > 0 ? '▲' : '▼'} {formatMoney(Math.abs(change))} {change > 0 ? 'more' : 'less'} than{' '}
              {displayed.compareLabel ?? `last ${displayed.viewScope}`}
            </Text>
          </View>
        )}

        <View style={styles.sumChart}>
          <SpendBarChart bars={displayed.bars} onPressDay={onPressDay} selectedKey={selectedKey} inset={0} />
        </View>
        <ChartLegend items={displayed.legend} inset={0} max={LEGEND_MAX} />

        {displayed.incomeMinor > 0 && (
          <View style={styles.sumStrip}>
            <View style={styles.sumStripCell}>
              <Text style={styles.sumKicker}>Money in</Text>
              <Text style={[styles.sumStripValue, displayed.incomeMinor > 0 && styles.income]}>
                {displayed.incomeMinor > 0 ? '+' : ''}
                {formatMoney(displayed.incomeMinor)}
              </Text>
            </View>
            <View style={[styles.sumStripCell, styles.sumStripCellRight]}>
              <Text style={styles.sumKicker}>Net</Text>
              <Text style={[styles.sumStripValue, net > 0 && styles.income, net < 0 && styles.expense]}>
                {net > 0 ? '+' : net < 0 ? '−' : ''}
                {formatMoney(Math.abs(net))}
              </Text>
            </View>
          </View>
        )}
      </ReanimatedAnimated.View>
    </View>
  );
}
