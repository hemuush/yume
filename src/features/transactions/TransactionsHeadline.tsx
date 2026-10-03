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
 * Spent figure + bar chart that slide with the period step, using ThisMonthHero's lagged-state technique.
 * `periodKey` = period shown; `direction` = step (+1 forward, -1 back, 0 scope toggle/picked month: fade).
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
  // As in ThisMonthHero.tsx: compare with the periodKey the effect last ran for, not `[periodKey]` alone (it
  // would leave `displayed` seeded from pre-load data). Same-period data syncs now; a new period slides.
  const prevPeriodKey = useRef(periodKey);
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  // Bumped per effect run so a delayed slide-out callback can tell it was superseded (see `commit` below)
  // instead of applying a stale snapshot.
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
    // The period flips a render before its reload resolves, so `bars` can be all-zero (new range, old rows).
    // `commit` drops this run's delayed `next` if a later run happened, so zeros can't clobber real data.
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
    // `direction` goes with its period and `opacity`/`tx` are stable; `direction` alone mustn't re-run this.
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
