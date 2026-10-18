import { SavingsGoal } from '@/types';
import { GoalRing, HiddenGoalRing } from '@/features/goals/GoalRing';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { HomeRow } from './HomeRow';

/**
 * One savings goal on Home, in the shared row: its progress ring, the name and what is saved of the target,
 * what is still to go on the right (or "Reached"). With savings amounts hidden the ring is an empty track and
 * only the target shows.
 */
export function HomeGoalRow({
  goal,
  divider,
  onPress,
}: {
  goal: SavingsGoal;
  divider: boolean;
  onPress: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const { secondary } = useAccent();
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const toGo = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  return (
    <HomeRow
      grow
      leading={
        hideAmounts ? (
          <HiddenGoalRing size={40} />
        ) : (
          <GoalRing
            percent={percent}
            color={done ? theme.colors.income : secondary}
            done={done}
            size={40}
            animKey={`goal-chip:${goal.id}`}
          />
        )
      }
      title={goal.name}
      subtitle={
        hideAmounts
          ? `Target ${formatMoney(goal.targetAmountMinor)}`
          : `${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}`
      }
      value={hideAmounts || done ? undefined : `${formatMoney(toGo)} to go`}
      chip={!hideAmounts && done ? { label: 'Reached', tone: 'complete' } : undefined}
      onPress={onPress}
      divider={divider}
      accessibilityLabel={
        hideAmounts
          ? `${goal.name}, saved amount hidden, target ${formatMoney(goal.targetAmountMinor)}`
          : `${goal.name}, ${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}, ${done ? 'reached' : `${Math.round(percent)} percent`}`
      }
    />
  );
}
