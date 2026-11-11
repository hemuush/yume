import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { SavingsGoal } from '@/types';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { selectedFill, themeInk } from '@/theme/interactionColors';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { dayMonthYear } from '@/lib/dateLabels';
import { toLocalIsoDate } from '@/lib/date';
import { styles as shared } from './goals.styles';
import { goalPlan, GOAL_PACE_LABEL } from './goalPlan';

/**
 * One goal as a row in the goals list: name and saved of target, a thin bar in the goal's colour, the share and
 * date, and the pace with what finishing on time takes. Tap opens edit/archive/delete; the round button adds
 * money, or for a followed account transfers into it (the only way its progress moves). Rows sit in one card
 * and are told apart by a hairline, so `divider` is set on every row but the first.
 */
export function GoalCard({
  goal,
  hue = theme.colors.idTeal,
  accountName,
  accountAvailable = true,
  divider = false,
  onPress,
  onContribute,
}: {
  goal: SavingsGoal;
  /** The goal's identity colour (goalHues). */
  hue?: string;
  /** The linked account's name, shown when the goal follows or reserves in it. */
  accountName?: string | null;
  accountAvailable?: boolean;
  /** A hairline above the row. */
  divider?: boolean;
  onPress: () => void;
  onContribute: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const { accent } = useAccent();
  const following = goal.tracksAccount && !!goal.linkedAccountId;
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const plan = goalPlan(goal, toLocalIsoDate(new Date()));
  const reached = done && !hideAmounts;
  const showButton = !goal.archived;
  const blocked = following && !accountAvailable;

  const fillPct = hideAmounts ? 0 : Math.min(100, Math.max(0, percent));
  const fillColor = reached ? theme.colors.slice.saved : hue;

  const when = goal.targetDate ? `By ${dayMonthYear(goal.targetDate)}` : 'No target date';
  const line = [
    reached ? 'Reached' : hideAmounts ? null : `${Math.round(percent)}%`,
    reached ? null : when,
    goal.reservesAccount ? `Reserved in ${accountName ?? 'its account'}` : null,
    following ? `Following ${accountName ?? 'its account'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const pace =
    hideAmounts || reached || !plan.pace
      ? null
      : [
          GOAL_PACE_LABEL[plan.pace],
          plan.perMonthMinor != null
            ? `${formatMoney(plan.perMonthMinor)}/mo`
            : plan.pastDue
              ? 'Past its target date'
              : null,
        ]
          .filter(Boolean)
          .join(' · ');

  const label = `${following ? 'Move money to' : goal.reservesAccount ? 'Manage reservation for' : 'Add money to'} ${goal.name}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        divider && styles.divider,
        goal.archived && shared.cardArchived,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.main}>
        <View style={styles.top}>
          <Text style={styles.name}>{goal.name}</Text>
          <Text style={styles.amounts}>
            {hideAmounts ? (
              <Text style={styles.saved}>
                {formatMaskableMoney(goal.currentAmountMinor, { masked: true })}
              </Text>
            ) : (
              <CountUpAmount
                minor={goal.currentAmountMinor}
                countFromZero={false}
                style={styles.saved}
                numberOfLines={1}
              />
            )}
            <Text style={styles.of}> / {formatMoney(goal.targetAmountMinor)}</Text>
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${fillPct}%`, backgroundColor: shade(fillColor, 60) }]} />
        </View>
        <View style={styles.bottom}>
          <Text style={styles.line}>{line}</Text>
          {pace && (
            <Text style={[styles.pace, plan.pace === 'behind' ? styles.behind : styles.onPace]}>{pace}</Text>
          )}
        </View>
        {blocked && (
          <Text style={styles.line}>
            Linked account unavailable. Edit this goal to choose another account.
          </Text>
        )}
      </View>
      {showButton && (
        <Pressable
          disabled={blocked}
          accessibilityState={{ disabled: blocked }}
          onPress={(event) => {
            event?.stopPropagation();
            if (blocked) return;
            if (following) router.push(`/add-transaction?type=transfer&toAccountId=${goal.linkedAccountId}`);
            else onContribute();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={styles.hit}
        >
          {({ pressed }) => (
            <View
              style={[
                styles.circle,
                { backgroundColor: selectedFill(accent) },
                pressed && styles.circlePressed,
                blocked && styles.blocked,
              ]}
            >
              <Feather name={following ? 'repeat' : 'plus'} size={18} color={themeInk(accent)} />
            </View>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  pressed: { backgroundColor: theme.colors.tray },
  main: { flex: 1, minWidth: 0, gap: 6 },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  name: { flexShrink: 1, fontFamily: theme.font.roundedBold, fontSize: 14, color: theme.colors.textPrimary },
  amounts: { flexShrink: 1 },
  saved: {
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  of: {
    fontFamily: theme.font.body,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textMuted,
  },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.inkHairline, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8 },
  line: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  pace: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12 },
  onPace: { color: theme.colors.incomeText },
  behind: { color: theme.colors.warnInk },
  // A 44 dp touch area around a 32 dp circle.
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  circlePressed: { opacity: 0.7 },
  blocked: { opacity: 0.4 },
});
