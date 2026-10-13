import { View, Pressable, Animated, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { SavingsGoal } from '@/types';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePressScale } from '@/lib/usePressScale';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
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
  const { secondary } = useAccent();
  const following = goal.tracksAccount && !!goal.linkedAccountId;
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const plan = goalPlan(goal, toLocalIsoDate(new Date()));
  const reached = done && !hideAmounts;
  const monthsLine =
    !hideAmounts && plan.perMonthMinor != null && plan.monthsLeft != null
      ? `${formatMoney(plan.perMonthMinor)} a month · ${plan.monthsLeft} ${plan.monthsLeft === 1 ? 'month' : 'months'} left`
      : !hideAmounts && plan.pastDue
        ? 'Past its target date'
        : null;
  const showPill = !goal.archived;

  const fillPct = hideAmounts ? 0 : Math.min(100, Math.max(0, percent));
  const fillColor = reached ? theme.colors.slice.saved : hue;
  const tags = (
    <>
      {!hideAmounts && plan.pace && (
        <View style={[styles.tag, plan.pace === 'behind' ? styles.tagWarn : styles.tagOk]}>
          <Text style={[styles.tagText, plan.pace === 'behind' ? styles.behind : styles.onPace]}>
            {GOAL_PACE_LABEL[plan.pace]}
          </Text>
        </View>
      )}
      {monthsLine && (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{monthsLine}</Text>
        </View>
      )}
      {goal.reservesAccount && (
        <View style={styles.tag}>
          <Text style={styles.tagText}>Reserved in {accountName ?? 'its account'}</Text>
        </View>
      )}
      {following && (
        <View style={[styles.tag, { backgroundColor: shade(secondary, 94) }]}>
          <Feather name="refresh-cw" size={10} color={theme.colors.textSecondary} />
          <Text style={styles.tagText}>Following {accountName ?? 'its account'}</Text>
        </View>
      )}
    </>
  );

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
          <Text style={styles.name}>{goal.name}</Text>
          {hideAmounts ? (
            <Feather name="eye-off" size={20} color={theme.colors.textMuted} />
          ) : reached ? (
            <Feather name="check-circle" size={28} color={theme.colors.incomeText} />
          ) : (
            <Text style={styles.pct}>
              {Math.round(percent)}
              <Text style={styles.pctSign}>%</Text>
            </Text>
          )}
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

        <Text style={styles.savedSummary}>
          {hideAmounts
            ? formatMaskableMoney(goal.currentAmountMinor, { masked: true })
            : formatMoney(goal.currentAmountMinor)}{' '}
          of {formatMoney(goal.targetAmountMinor)} ·{' '}
          {reached ? 'Reached' : goal.targetDate ? `By ${dayMonthYear(goal.targetDate)}` : 'No target date'}
        </Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${fillPct}%`, backgroundColor: shade(fillColor, 60) }]} />
        </View>

        <View style={styles.footer}>
          <View style={styles.tags}>{tags}</View>
          {showPill && (
            <Pressable
              onPress={(event) => {
                event?.stopPropagation();
                if (following)
                  router.push(`/add-transaction?type=transfer&toAccountId=${goal.linkedAccountId}`);
                else onContribute();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${following ? 'Move money to' : goal.reservesAccount ? 'Manage reservation for' : 'Add money to'} ${goal.name}`}
              hitSlop={8}
              style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
            >
              <Text style={styles.pillText}>
                {following ? 'Move money' : goal.reservesAccount ? 'Reserve / release' : 'Add money'}
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 12 },
  // A quiet surface with one thin, colour-coded progress bar.
  card: {
    padding: 14,
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  track: { height: 5, borderRadius: 3, backgroundColor: theme.colors.inkWash, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  pct: {
    fontFamily: theme.font.bodyLight,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    lineHeight: 21,
    color: theme.colors.textPrimary,
  },
  pctSign: { fontFamily: theme.font.body, fontSize: 15, letterSpacing: 0, color: theme.colors.textMuted },
  figs: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap', flexShrink: 1 },
  toGo: {
    fontFamily: theme.font.bodyMedium,
    fontVariant: ['tabular-nums'],
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  toGoLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  reached: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.incomeText },
  name: {
    fontFamily: theme.font.roundedBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 0,
  },
  savedSummary: {
    fontFamily: theme.font.bodyMedium,
    fontVariant: ['tabular-nums'],
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.textPrimary,
  },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  tags: { flexGrow: 1, flexBasis: 140, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 20,
    paddingHorizontal: 0,
    borderRadius: theme.radius.pill,
    maxWidth: '100%',
  },
  tagOk: { paddingHorizontal: 8, backgroundColor: theme.colors.secondaryTint },
  tagWarn: { paddingHorizontal: 8, backgroundColor: theme.colors.dueRow },
  tagText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  onPace: { color: theme.colors.incomeText },
  behind: { color: theme.colors.warnInk },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  pillPressed: { opacity: 0.8 },
  pillText: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.surface },
});
