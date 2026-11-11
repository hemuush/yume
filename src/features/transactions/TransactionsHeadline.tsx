import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { SpendBarChart } from './SpendBarChart';
import type { SpendBar } from './spendChart';
import { styles } from './transactions.styles';
import { DURATIONS } from '@/lib/motionTimings';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { screenStyles } from '@/components/screenStyles';

interface HeadlineContent {
  expenseMinor: number;
  incomeMinor: number;
  /** This period's spend less the comparison period's; null when there is nothing to compare. */
  expenseChangeMinor: number | null;
  viewScope: 'week' | 'month';
  /** What the change pill compares with; defaults to "last week"/"last month". */
  compareLabel?: string;
  bars: SpendBar[];
}

/**
 * Cream Spent card: committed figures, chips and bars enter together on a period step.
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
  bars,
  onPressDay,
  selectedKey,
  current = false,
  narrowedTo = null,
}: HeadlineContent & {
  periodKey: string;
  direction: -1 | 0 | 1;
  onPressDay: (key: string) => void;
  /** The tapped bar, if any — see SpendBarChart's `selectedKey`. */
  selectedKey: string | null;
  /** The period shown is this week or month: the kicker says so ("Spent this week"); otherwise just "Spent". */
  current?: boolean;
  /** The category (or "3 categories") the list is filtered to; the bars passed in hold only its spending. */
  narrowedTo?: string | null;
}) {
  const reduce = useReduceMotion();
  // Render the committed period immediately so chart taps and timeline rows share one snapshot.
  const displayed: HeadlineContent = {
    expenseMinor,
    incomeMinor,
    expenseChangeMinor,
    viewScope,
    compareLabel,
    bars,
  };
  const prevPeriodKey = useRef(periodKey);
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  const directionRef = useRef(direction);
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    cancelAnimation(tx);
    cancelAnimation(opacity);
    const changed = prevPeriodKey.current !== periodKey;
    prevPeriodKey.current = periodKey;
    tx.value = 0;
    opacity.value = 1;
    if (changed && !reduce) {
      tx.value = directionRef.current * 18;
      opacity.value = 0;
      tx.value = withTiming(0, { duration: DURATIONS.slideIn });
      opacity.value = withTiming(1, { duration: DURATIONS.slideIn });
    }
    return () => {
      cancelAnimation(tx);
      cancelAnimation(opacity);
    };
  }, [periodKey, reduce, tx, opacity]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  const net = displayed.incomeMinor - displayed.expenseMinor;
  const change = displayed.expenseChangeMinor;
  // Narrowed to a category (a chip under the chart): the figure is what the bars hold for it, and the
  // comparison and cash flow, which are about the whole period, step aside.
  const narrowed = !!narrowedTo;
  const shownMinor = narrowed
    ? displayed.bars.reduce((sum, bar) => (bar.state ? sum : sum + bar.totalMinor), 0)
    : displayed.expenseMinor;
  // What a day cost so far: the days that have happened, empty ones too (an empty day is a cheap one).
  const elapsed = displayed.bars.filter((bar) => !bar.state);
  const averageMinor =
    elapsed.length > 1
      ? Math.round(elapsed.reduce((sum, bar) => sum + bar.totalMinor, 0) / elapsed.length)
      : null;
  const compareTo = displayed.compareLabel ?? `last ${displayed.viewScope}`;
  const kicker = narrowed
    ? `Spent on ${narrowedTo}${current ? ` this ${viewScope}` : ''}`
    : current
      ? `Spent this ${viewScope}`
      : 'Spent';
  return (
    <View style={[screenStyles.card, styles.sumCard]}>
      <ReanimatedAnimated.View style={slideStyle}>
        <View style={styles.sumLead}>
          <Text style={styles.sumKicker}>{kicker}</Text>
          <CountUpAmount
            key={`${periodKey}:${narrowedTo ?? ''}`}
            countFromZero={false}
            minor={shownMinor}
            style={styles.headlineAmt}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          {!narrowed && change != null && change !== 0 && (
            <View
              style={styles.sumChangeRow}
              accessible
              accessibilityLabel={`${formatMoney(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than ${compareTo}`}
            >
              <Feather
                name={change > 0 ? 'arrow-up-right' : 'arrow-down-right'}
                size={12}
                color={change > 0 ? theme.colors.expenseText : theme.colors.incomeText}
              />
              <Text style={styles.sumChangeText}>
                <Text style={[styles.sumChangeValue, change > 0 ? styles.expense : styles.income]}>
                  {formatMoney(Math.abs(change))} {change > 0 ? 'more' : 'less'}
                </Text>{' '}
                than {compareTo}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.sumChart}>
          <SpendBarChart
            bars={displayed.bars}
            onPressDay={onPressDay}
            selectedKey={selectedKey}
            inset={0}
            dates={viewScope === 'week'}
            averageMinor={narrowed ? null : averageMinor}
          />
        </View>
        {!narrowed && displayed.incomeMinor > 0 && (
          <View style={styles.sumCashflow}>
            <View style={styles.sumMetric}>
              <Text style={styles.sumKicker}>Money in</Text>
              <Text style={[styles.sumMetricAmount, styles.income]}>
                {formatMoney(displayed.incomeMinor)}
              </Text>
            </View>
            <View style={styles.sumMetric}>
              <Text style={styles.sumKicker}>Left</Text>
              <Text style={[styles.sumMetricAmount, net > 0 && styles.income, net < 0 && styles.expense]}>
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
