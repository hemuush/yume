import { useState } from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from '@/features/home/homeInk';
import { withPressed } from '@/lib/pressed';
import { TrendChart, MIN_TREND_POINTS } from './TrendChart';
import { CashFlowCard } from './CashFlowCard';
type Props = React.ComponentProps<typeof TrendChart> & {
  cashFlow: React.ComponentProps<typeof CashFlowCard>['points'];
};
/** One selected metric owns the primary chart; period/privacy changes cannot leave an invalid metric active. */
export function ReportTrends({ cashFlow, ...props }: Props) {
  const [metric, setMetric] = useState('spend');
  const { accent } = useAccent();
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
      <View style={s.switch} accessibilityRole="radiogroup">
        {options.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityLabel={`Trend metric: ${option.label}`}
            accessibilityState={{ selected: option.key === selected }}
            onPress={() => setMetric(option.key)}
            style={withPressed([s.option, option.key === selected && { backgroundColor: homeInk(accent) }])}
          >
            <Text style={[s.label, option.key === selected && s.active]}>{option.label}</Text>
          </Pressable>
        ))}
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
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
    gap: 4,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceAlt,
    marginBottom: 12,
  },
  option: {
    flexGrow: 1,
    flexBasis: 80,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    borderRadius: 22,
  },
  label: { fontFamily: theme.font.roundedMedium, fontSize: 12, color: theme.colors.textSecondary },
  active: { color: theme.colors.surface, fontFamily: theme.font.roundedBold },
});
