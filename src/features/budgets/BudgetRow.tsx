import { View, Text, Pressable, Animated } from 'react-native';
import { BudgetProgress } from '@/db/budgets';
import { formatMoney } from '@/lib/money';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LimitMeter } from '@/components/LimitMeter';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from './budgets.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One category's monthly limit and how much of it is gone — tap to edit, long-press to delete. */
export function BudgetRow({
  progress,
  divider,
  onPress,
  onLongPress,
}: {
  progress: BudgetProgress;
  divider: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const barPct = Math.min(100, progress.percentUsed);

  return (
    <AnimatedPressable
      style={[styles.row, divider && styles.rowDivider, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
    >
      <View style={styles.rowTop}>
        <CategoryIcon name={progress.categoryIcon} color={progress.categoryColor} square={36} size={16} />
        <Text style={styles.rowName} numberOfLines={1}>
          {progress.categoryName}
        </Text>
        <Text style={styles.rowAmount}>
          <Text style={progress.overBudget ? styles.rowAmountOver : undefined}>
            {formatMoney(progress.spentMinor)}
          </Text>
          <Text style={styles.rowAmountOf}> / {formatMoney(progress.effectiveLimitMinor)}</Text>
        </Text>
      </View>
      <LimitMeter pct={barPct} tone={progress.overBudget ? 'over' : 'ok'} />
      <Text style={[styles.rowNote, progress.overBudget && styles.rowNoteOver]}>
        {progress.overBudget
          ? `${formatMoney(Math.abs(progress.remainingMinor))} over budget`
          : `${formatMoney(progress.remainingMinor)} left this month`}
      </Text>
    </AnimatedPressable>
  );
}
