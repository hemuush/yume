import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatPctChange } from '@/lib/format';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { SpendBarChart, ChartLegend } from './SpendBarChart';
import { SpendBar, ChartLegendItem } from './spendChart';
import { styles } from './transactions.styles';

interface HeadlineContent {
  expenseMinor: number;
  expenseChangePct: number | null;
  viewScope: 'week' | 'month';
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
  expenseChangePct,
  viewScope,
  bars,
  legend,
  onPressDay,
}: HeadlineContent & { periodKey: string; direction: -1 | 0 | 1; onPressDay: (key: string) => void }) {
  const reduce = useReduceMotion();
  const [displayed, setDisplayed] = useState<HeadlineContent>({
    expenseMinor,
    expenseChangePct,
    viewScope,
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
    const next: HeadlineContent = { expenseMinor, expenseChangePct, viewScope, bars, legend };
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
    opacity.value = withTiming(0, { duration: 140 });
    tx.value = withTiming(outX, { duration: 140 }, (finished) => {
      if (!finished) return;
      runOnJS(commit)();
      tx.value = inX;
      tx.value = withTiming(0, { duration: 220 });
      opacity.value = withTiming(1, { duration: 220 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, expenseMinor, expenseChangePct, viewScope, bars, legend, reduce]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  return (
    <ReanimatedAnimated.View style={slideStyle}>
      <View style={styles.headline}>
        <CountUpAmount
          minor={displayed.expenseMinor}
          style={styles.headlineAmt}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Text style={styles.headlineSub}>
          spent this {displayed.viewScope}
          {displayed.expenseChangePct != null && (
            <>
              {' · '}
              <Text style={displayed.expenseChangePct > 0 ? styles.headlineSubUp : styles.headlineSubDown}>
                {formatPctChange(displayed.expenseChangePct)}{' '}
                {displayed.expenseChangePct > 0 ? 'more' : 'less'}
              </Text>{' '}
              than last {displayed.viewScope}
            </>
          )}
        </Text>
      </View>

      <SpendBarChart bars={displayed.bars} onPressDay={onPressDay} />
      <ChartLegend items={displayed.legend} />
      <View style={styles.rule} />
    </ReanimatedAnimated.View>
  );
}
