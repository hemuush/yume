import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { SpendBarChart, ChartLegend } from './SpendBarChart';
import { SpendBar, ChartLegendItem } from './spendChart';
import { styles } from './transactions.styles';
import { DURATIONS } from '@/lib/motionTimings';
import { Glass } from '@/components/Glass';

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
 * Frosted Spent card: committed figures, chips and bars enter together on a period step.
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
  legend,
  onPressDay,
  selectedKey,
  current = false,
}: HeadlineContent & {
  periodKey: string;
  direction: -1 | 0 | 1;
  onPressDay: (key: string) => void;
  /** The tapped bar, if any — see SpendBarChart's `selectedKey`. */
  selectedKey: string | null;
  /** The period shown is this week or month: the kicker says so ("Spent this week"); otherwise just "Spent". */
  current?: boolean;
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
    legend,
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
  return (
    <Glass radius={28} style={styles.sumCard}>
      <Text style={styles.sumKicker} numberOfLines={1}>
        {current ? `Spent this ${viewScope}` : 'Spent'}
      </Text>
      <ReanimatedAnimated.View style={slideStyle}>
        <CountUpAmount
          key={periodKey}
          countFromZero={false}
          minor={displayed.expenseMinor}
          style={styles.headlineAmt}
          symbolStyle={styles.headlineSymbol}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        {/* The change, then money in and the net, as small chips under the figure. */}
        {((change != null && change !== 0) || displayed.incomeMinor > 0) && (
          <View style={styles.sumChips}>
            {change != null && change !== 0 && (
              <View style={[styles.sumChip, change > 0 ? styles.changePillUp : styles.changePillDown]}>
                <Feather
                  name={change > 0 ? 'arrow-up-right' : 'arrow-down-right'}
                  size={12}
                  color={change > 0 ? theme.colors.expenseText : theme.colors.incomeText}
                />
                <Text style={[styles.sumChipText, change > 0 ? styles.expense : styles.income]}>
                  {formatMoney(Math.abs(change))} {change > 0 ? 'more' : 'less'} than{' '}
                  {displayed.compareLabel ?? `last ${displayed.viewScope}`}
                </Text>
              </View>
            )}
            {displayed.incomeMinor > 0 && (
              <>
                <View
                  style={styles.sumChip}
                  accessible
                  accessibilityLabel={`Money in, ${formatMoney(displayed.incomeMinor)}`}
                >
                  <Feather name="arrow-down-left" size={12} color={theme.colors.incomeText} />
                  <Text style={[styles.sumChipText, styles.income]}>
                    {formatMoney(displayed.incomeMinor)} in
                  </Text>
                </View>
                <View
                  style={styles.sumChip}
                  accessible
                  accessibilityLabel={`Net, ${net < 0 ? 'minus ' : ''}${formatMoney(Math.abs(net))}`}
                >
                  <Text style={[styles.sumChipText, net > 0 && styles.income, net < 0 && styles.expense]}>
                    Net {net > 0 ? '+' : net < 0 ? '−' : ''}
                    {formatMoney(Math.abs(net))}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.sumChart}>
          <SpendBarChart bars={displayed.bars} onPressDay={onPressDay} selectedKey={selectedKey} inset={0} />
        </View>
        <ChartLegend items={displayed.legend} inset={0} max={LEGEND_MAX} />
      </ReanimatedAnimated.View>
    </Glass>
  );
}
