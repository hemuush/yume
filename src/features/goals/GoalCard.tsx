import { View, Pressable, Animated, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { GrowFill } from '@/components/GrowFill';
import { CountUpAmount } from '@/components/CountUpAmount';
import { SavingsGoal } from '@/types';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePressScale } from '@/lib/usePressScale';
import { usePrivacy } from '@/theme/PrivacyContext';
import { dayMonthYear } from '@/lib/dateLabels';
import { toLocalIsoDate } from '@/lib/date';
import { styles as shared } from './goals.styles';
import { goalPlan, GOAL_PACE_LABEL } from './goalPlan';

/**
 * One full-width goal: what's left, progress, monthly amount to finish on time. Tap opens edit/archive/delete;
 * the pill contributes, or for a followed account transfers into it (the only way its progress moves).
 */
export function GoalCard({
  goal,
  hue = theme.colors.idTeal,
  accountName,
  onPress,
  onContribute,
}: {
  goal: SavingsGoal;
  /** The goal's identity colour (goalHues). */
  hue?: string;
  /** The linked account's name — shown when the goal follows it. */
  accountName?: string | null;
  onPress: () => void;
  onContribute: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const following = goal.tracksAccount && !!goal.linkedAccountId;
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const plan = goalPlan(goal, toLocalIsoDate(new Date()));
  const reached = done && !hideAmounts;
  const tone = reached ? theme.colors.idSage : hue;
  const monthsLine =
    !hideAmounts && plan.perMonthMinor != null && plan.monthsLeft != null
      ? `${formatMoney(plan.perMonthMinor)} a month · ${plan.monthsLeft} ${plan.monthsLeft === 1 ? 'month' : 'months'} left`
      : !hideAmounts && plan.pastDue
        ? 'Past its target date'
        : null;
  const showPill = !goal.archived;

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        style={[styles.card, goal.archived && shared.cardArchived]}
      >
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: shade(tone, 90) }]}>
            {hideAmounts ? (
              <Feather name="eye-off" size={16} color={theme.colors.textMuted} />
            ) : (
              <MaterialCommunityIcons
                name={reached ? 'check' : following ? 'bank-outline' : 'piggy-bank-outline'}
                size={18}
                color={reached ? theme.colors.incomeText : shade(tone, 30, 10)}
              />
            )}
          </View>
          <View style={styles.headText}>
            <Text style={styles.name} numberOfLines={1}>
              {goal.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {reached
                ? `Reached · ${formatMoney(goal.targetAmountMinor)}`
                : goal.targetDate
                  ? `By ${dayMonthYear(goal.targetDate)}`
                  : 'No target date'}
            </Text>
          </View>
          <View style={styles.figs}>
            {reached ? (
              <Text style={styles.reached}>Reached</Text>
            ) : hideAmounts ? (
              <Text style={styles.toGo}>{formatMaskableMoney(plan.toGoMinor, { masked: true })}</Text>
            ) : (
              <>
                <CountUpAmount
                  minor={plan.toGoMinor}
                  countFromZero={false}
                  style={styles.toGo}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                />
                <Text style={styles.toGoLabel}>to go</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.track}>
          <GrowFill
            animKey={`goal-bar:${goal.id}`}
            pct={hideAmounts ? 0 : percent}
            style={[styles.fill, { backgroundColor: reached ? theme.colors.income : shade(tone, 66) }]}
          />
        </View>
        <View style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={1}>
            {hideAmounts ? (
              `${formatMaskableMoney(goal.currentAmountMinor, { masked: true })} of ${formatMoney(goal.targetAmountMinor)}`
            ) : (
              <>
                <Text style={styles.captionBold}>{Math.round(percent)}%</Text>
                {` · ${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}`}
              </>
            )}
          </Text>
          {!hideAmounts && plan.pace && (
            <Text style={[styles.captionText, plan.pace === 'behind' && styles.behind]} numberOfLines={1}>
              {GOAL_PACE_LABEL[plan.pace]}
            </Text>
          )}
        </View>

        {(showPill || monthsLine || following) && (
          <View style={styles.footer}>
            <View style={styles.footerText}>
              {monthsLine && (
                <Text style={styles.months} numberOfLines={1}>
                  {monthsLine}
                </Text>
              )}
              {following && (
                <View style={[shared.followTag, !monthsLine && styles.followFirst]}>
                  <Feather name="refresh-cw" size={10} color={theme.colors.textSecondary} />
                  <Text style={shared.followTagText} numberOfLines={1}>
                    Following {accountName ?? 'its account'}
                  </Text>
                </View>
              )}
            </View>
            {showPill && (
              <Pressable
                onPress={
                  following
                    ? () => router.push(`/add-transaction?type=transfer&toAccountId=${goal.linkedAccountId}`)
                    : onContribute
                }
                accessibilityRole="button"
                accessibilityLabel={`${following ? 'Move money to' : 'Add money to'} ${goal.name}`}
                hitSlop={8}
                style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
              >
                <Text style={styles.pillText}>{following ? 'Move money' : 'Add money'}</Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 10 },
  // A white card like every other on the screen; the goal's own colour is in its icon and its bar.
  card: {
    padding: 16,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, minWidth: 0 },
  name: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  figs: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  toGo: { fontFamily: theme.font.monoBold, fontSize: 16, color: theme.colors.textPrimary },
  toGoLabel: { fontFamily: theme.font.body, fontSize: 10.5, color: theme.colors.textSecondary, marginTop: 1 },
  reached: { fontFamily: theme.font.roundedBold, fontSize: 14, color: theme.colors.incomeText },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.divider,
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  caption: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  captionText: {
    fontFamily: theme.font.mono,
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  captionBold: { fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },
  behind: { fontFamily: theme.font.monoBold, color: theme.colors.warnInk },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  footerText: { flex: 1, minWidth: 0 },
  months: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  followFirst: { marginTop: 0 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  pillPressed: { opacity: 0.8 },
  pillText: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.surface },
});
