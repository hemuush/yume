import { Text, Pressable, StyleSheet, Animated } from 'react-native';
import { SavingsGoal } from '@/types';
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePressScale } from '@/lib/usePressScale';
import { GoalRing } from './GoalRing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Home's compact preview of a goal — same shape as AccountChip, for the horizontal "Savings goals" strip. */
export function GoalChip({ goal, onPress }: { goal: SavingsGoal; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  return (
    <AnimatedPressable
      style={[styles.chip, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <GoalRing
        percent={percent}
        color={done ? theme.colors.income : theme.colors.secondary}
        done={done}
        size={40}
      />
      <Text style={styles.name} numberOfLines={1}>
        {goal.name}
      </Text>
      <Text style={styles.amt} numberOfLines={1}>
        {formatMoney(goal.currentAmountMinor)}{' '}
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
