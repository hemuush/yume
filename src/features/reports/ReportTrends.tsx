import { useState } from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState } from '@/components/EmptyState';
import { TrendChart, MIN_TREND_POINTS } from './TrendChart';
import { CashFlowCard } from './CashFlowCard';
type Props = Omit<React.ComponentProps<typeof TrendChart>, 'fixedKind'> & {
  cashFlow: React.ComponentProps<typeof CashFlowCard>['points'];
};
/** One selected metric owns the primary chart; period/privacy changes cannot leave an invalid metric active. */
export function ReportTrends({ cashFlow, ...props }: Props) {
  const [metric, setMetric] = useState('spend');
  const options = [
    {
      key: 'spend',
      label: 'Spending',
      available: props.trend.length >= MIN_TREND_POINTS && props.trend.some((p) => p.recorded !== false),
    },
    {
      key: 'flow',
      label: 'Cash flow',
      available:
        cashFlow.length >= MIN_TREND_POINTS &&
        cashFlow.some((p) => p.recorded !== false && p.incomeMinor > 0),
    },
    {
      key: 'netWorth',
      label: 'Net worth',
      available:
        props.netWorthTrend.length >= MIN_TREND_POINTS &&
        props.netWorthTrend.some((p) => p.recorded !== false),
    },
  ].filter((o) => o.available);
  const selected = options.find((o) => o.key === metric)?.key ?? options[0]?.key;
  if (!selected)
    return (
      <EmptyState
        title="Not enough history yet"
        subtitle="Charts appear when enough recorded history is available."
      />
    );
  return (
    <View>
      <View style={s.switch}>
        <SegmentedControl
          options={options.map((o) => ({ label: o.label, value: o.key }))}
          value={selected}
          onChange={setMetric}
          onBand
        />
      </View>
      <Animated.View key={selected} entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}>
        {selected === 'flow' ? (
          <CashFlowCard points={cashFlow} inProgress={!!props.inProgress} monthLink={props.monthLink} />
        ) : (
          <TrendChart key={selected} {...props} fixedKind={selected === 'netWorth' ? 'netWorth' : 'spend'} />
        )}
      </Animated.View>
    </View>
  );
}
const s = StyleSheet.create({
  switch: { marginBottom: 12 },
});
