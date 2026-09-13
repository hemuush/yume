import { View, Text, Pressable, Animated } from 'react-native';
import { SavingsGoal } from '@/types';
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePressScale } from '@/lib/usePressScale';
import { GoalRing } from './GoalRing';
import { styles } from './goals.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One goal, full-width — tap opens edit/archive/delete, the button below opens the contribute sheet. */
export function GoalCard({
  goal,
  onPress,
  onContribute,
}: {
  goal: SavingsGoal;
  onPress: () => void;
  onContribute: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const ringColor = done ? theme.colors.income : theme.colors.secondary;

  return (
    <View style={[styles.card, goal.archived && styles.cardArchived]}>
      <AnimatedPressable
        style={[styles.cardTop, animatedStyle]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <GoalRing percent={percent} color={ringColor} done={done} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.cardTarget}>
            {done
              ? `Reached · ${formatMoney(goal.targetAmountMinor)}`
              : goal.targetDate
                ? `By ${goal.targetDate} · ${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}`
                : `${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}`}
          </Text>
        </View>
      </AnimatedPressable>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: ringColor }]} />
      </View>
      {!goal.archived && (
        <Pressable style={styles.contributeBtn} onPress={onContribute} accessibilityRole="button">
          <Text style={styles.contributeBtnText}>+ Add money</Text>
        </Pressable>
      )}
    </View>
  );
}
