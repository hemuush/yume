import { Pressable, StyleSheet, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { SavingsGoal } from '@/types';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePressScale } from '@/lib/usePressScale';
import { usePrivacy } from '@/theme/PrivacyContext';
import { GoalRing, HiddenGoalRing } from './GoalRing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Home's compact preview of a goal — for the horizontal "Savings goals" strip.
 * With savings amounts hidden, the saved amount and the progress ring are
 * withheld (an empty track with an eye-off icon); only the target shows.
 */
export function GoalChip({ goal, onPress }: { goal: SavingsGoal; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  const { hideAmounts } = usePrivacy();
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  return (
    <AnimatedPressable
      style={[styles.chip, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={
        hideAmounts
          ? `${goal.name}, saved amount hidden, target ${formatMoney(goal.targetAmountMinor)}`
          : `${goal.name}, ${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}, ${done ? 'reached' : `${Math.round(percent)} percent`}`
      }
    >
      {hideAmounts ? (
        <HiddenGoalRing size={40} />
      ) : (
        <GoalRing
          percent={percent}
          color={done ? theme.colors.income : theme.colors.secondary}
          done={done}
          size={40}
          animKey={`goal-chip:${goal.id}`}
        />
      )}
      <Text style={styles.name} numberOfLines={1}>
        {goal.name}
      </Text>
      <Text style={styles.amt} numberOfLines={1} adjustsFontSizeToFit>
        {formatMaskableMoney(goal.currentAmountMinor, { masked: hideAmounts })}{' '}
        <Text style={styles.of}>/ {formatMoney(goal.targetAmountMinor)}</Text>
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 128,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl,
    padding: 12,
  },
  name: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary, marginTop: 8 },
  amt: { fontFamily: theme.font.mono, fontSize: 10.5, color: theme.colors.textSecondary, marginTop: 3 },
  of: { color: theme.colors.textMuted },
});
