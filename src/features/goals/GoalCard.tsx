import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { GrowFill } from '@/components/GrowFill';
import { CountUpAmount } from '@/components/CountUpAmount';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { SavingsGoal } from '@/types';
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePressScale } from '@/lib/usePressScale';
import { GoalRing } from './GoalRing';
import { styles } from './goals.styles';
import { withPressed } from '@/lib/pressed';
import { dayMonthYear } from '@/lib/dateLabels';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One goal, full-width — tap opens edit/archive/delete. The button below
 * opens the contribute sheet, or for a goal following its account, a
 * transfer into that account (the only way its progress moves).
 */
export function GoalCard({
  goal,
  accountName,
  onPress,
  onContribute,
}: {
  goal: SavingsGoal;
  /** The linked account's name — shown when the goal follows it. */
  accountName?: string | null;
  onPress: () => void;
  onContribute: () => void;
}) {
  const following = goal.tracksAccount && !!goal.linkedAccountId;
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
        <GoalRing percent={percent} color={ringColor} done={done} size={46} animKey={`goal:${goal.id}`} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.cardTarget}>
            {done ? (
              `Reached · ${formatMoney(goal.targetAmountMinor)}`
            ) : (
              <>
                {goal.targetDate ? `By ${dayMonthYear(goal.targetDate)} · ` : ''}
                {/* Rolls to the new total when money is added, alongside the ring. */}
                <CountUpAmount minor={goal.currentAmountMinor} countFromZero={false} />
                {` of ${formatMoney(goal.targetAmountMinor)}`}
              </>
            )}
          </Text>
          {following && (
            <View style={styles.followTag}>
              <Feather name="refresh-cw" size={10} color={theme.colors.textSecondary} />
              <Text style={styles.followTagText} numberOfLines={1}>
                Following {accountName ?? 'its account'}
              </Text>
            </View>
          )}
        </View>
      </AnimatedPressable>
      <View style={styles.track}>
        <GrowFill
          animKey={`goal-bar:${goal.id}`}
          pct={percent}
          style={[styles.fill, { backgroundColor: ringColor }]}
        />
      </View>
      {!goal.archived && (
        <Pressable
          style={withPressed(styles.contributeBtn)}
          onPress={
            following
              ? () => router.push(`/add-transaction?type=transfer&toAccountId=${goal.linkedAccountId}`)
              : onContribute
          }
          accessibilityRole="button"
        >
          <Text style={styles.contributeBtnText}>{following ? 'Move money here' : '+ Add money'}</Text>
        </Pressable>
      )}
    </View>
  );
}
