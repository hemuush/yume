import { View, Pressable, Animated, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { GLASS } from '@/components/Glass';
import { softTint } from '@/components/softTint';
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
          <Text style={styles.tagText} numberOfLines={1}>
            {monthsLine}
          </Text>
        </View>
      )}
      {following && (
        <View style={[styles.tag, { backgroundColor: shade(secondary, 94) }]}>
          <Feather name="refresh-cw" size={10} color={theme.colors.textSecondary} />
          <Text style={styles.tagText} numberOfLines={1}>
            Following {accountName ?? 'its account'}
          </Text>
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
        {/* Fills from the bottom to how far along it is, in the goal's colour (as on Plan). */}
        {fillPct > 0 && (
          <View style={[styles.fill, { height: `${fillPct}%`, backgroundColor: softTint(fillColor, 0.45) }]}>
            <View style={[styles.fillEdge, { backgroundColor: shade(fillColor, 60) }]} />
          </View>
        )}
        <View style={styles.head}>
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

        <Text style={styles.name} numberOfLines={1}>
          {goal.name}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {hideAmounts
            ? formatMaskableMoney(goal.currentAmountMinor, { masked: true })
            : formatMoney(goal.currentAmountMinor)}{' '}
          of {formatMoney(goal.targetAmountMinor)} ·{' '}
          {reached ? 'Reached' : goal.targetDate ? `By ${dayMonthYear(goal.targetDate)}` : 'No target date'}
        </Text>

        <View style={styles.footer}>
          <View style={styles.tags}>{tags}</View>
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
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 12 },
  // Frosted glass that fills from the bottom; the goal's colour is the liquid.
  card: {
    minHeight: 156,
    padding: 16,
    gap: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fill,
    boxShadow: GLASS.shadow,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fillEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, opacity: 0.8 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 38,
  },
  pct: {
    fontFamily: theme.font.bodyLight,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.2,
    color: theme.colors.textPrimary,
  },
  pctSign: { fontFamily: theme.font.body, fontSize: 15, letterSpacing: 0, color: theme.colors.textMuted },
  figs: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '50%' },
  toGo: { fontFamily: theme.font.bodyMedium, fontSize: 16, color: theme.colors.textPrimary },
  toGoLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  reached: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.incomeText },
  name: {
    fontFamily: theme.font.roundedBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginTop: 'auto',
  },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  tags: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    maxWidth: '100%',
  },
  tagOk: { backgroundColor: '#CDEFD9', borderColor: '#CDEFD9' },
  tagWarn: { backgroundColor: '#FFE6C7', borderColor: '#FFE6C7' },
  tagText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  onPace: { color: theme.colors.incomeText },
  behind: { color: theme.colors.warnInk },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  pillPressed: { opacity: 0.8 },
  pillText: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.surface },
});
