import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { SavingsGoal } from '@/types';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { selectedFill, themeInk } from '@/theme/interactionColors';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { dayMonthYear } from '@/lib/dateLabels';
import { toLocalIsoDate } from '@/lib/date';
import { styles as shared } from './goals.styles';
import { goalPlan, GOAL_PACE_LABEL } from './goalPlan';
import { themedStyles } from '@/theme/themedStyles';
import { PlanMoneyRow, planRowText } from '@/features/plan/PlanMoneyRow';

/**
 * One goal as a row in the goals list: name and saved of target, a thin bar in the goal's colour, the share and
 * date, and the pace with what finishing on time takes. Tap opens edit/archive/delete; the round button adds
 * money, or for a followed account transfers into it (the only way its progress moves). Rows sit in one card
 * and are told apart by a hairline, so `divider` is set on every row but the first.
 */
export function GoalCard({
  goal,
  accountName,
  accountAvailable = true,
  divider = false,
  onPress,
  onContribute,
  compact = false,
}: {
  goal: SavingsGoal;
  /** The linked account's name, shown when the goal follows or reserves in it. */
  accountName?: string | null;
  accountAvailable?: boolean;
  /** A hairline above the row. */
  divider?: boolean;
  onPress: () => void;
  onContribute: () => void;
  compact?: boolean;
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

  const when = goal.targetDate ? `By ${dayMonthYear(goal.targetDate)}` : 'No target date';
  const line = [
    reached ? 'Reached' : hideAmounts ? null : `${Math.round(percent)}%`,
    reached || (compact && !goal.targetDate) ? null : when,
    goal.reservesAccount ? `Reserved in ${accountName ?? 'its account'}` : null,
    following && (!compact || hideAmounts) ? `Following ${accountName ?? 'its account'}` : null,
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
  const amount = hideAmounts ? (
    <Text style={styles.saved}>{formatMaskableMoney(goal.currentAmountMinor, { masked: true })}</Text>
  ) : (
    <CountUpAmount
      minor={goal.currentAmountMinor}
      style={styles.saved}
      numberOfLines={compact ? undefined : 1}
    />
  );
  const status = (
    <View style={styles.bottom}>
      {!!line && <Text style={[styles.line, compact && reached && styles.onPace]}>{line}</Text>}
      {pace && (!compact || plan.pace === 'behind') && (
        <Text style={[styles.pace, plan.pace === 'behind' ? styles.behind : styles.onPace]}>{pace}</Text>
      )}
    </View>
  );

  const action = showButton && (
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
            { backgroundColor: compact ? theme.colors.home.control : selectedFill(accent) },
            pressed && styles.circlePressed,
            blocked && styles.blocked,
          ]}
        >
          <Feather
            name={following ? 'repeat' : 'plus'}
            size={compact ? 15 : 18}
            color={compact ? theme.colors.link : themeInk(accent)}
          />
        </View>
      )}
    </Pressable>
  );
  if (compact)
    return (
      <PlanMoneyRow
        icon={
          <View style={[styles.disc, { backgroundColor: theme.colors.flatMint }]}>
            <Feather name={reached ? 'check' : 'flag'} size={17} color={theme.colors.onFlat} />
          </View>
        }
        title={goal.name}
        subtitle={
          <>
            {!!line && <Text style={[planRowText.subtitle, reached && planRowText.good]}>{line}</Text>}
            {pace && plan.pace === 'behind' && (
              <Text style={[planRowText.subtitle, planRowText.warn]}>{pace}</Text>
            )}
            {blocked && (
              <Text style={[planRowText.subtitle, planRowText.bad]}>
                Linked account unavailable. Edit this goal to choose another account.
              </Text>
            )}
          </>
        }
        value={
          hideAmounts ? (
            <Text style={planRowText.value}>
              {formatMaskableMoney(goal.currentAmountMinor, { masked: true })}
            </Text>
          ) : (
            <CountUpAmount minor={goal.currentAmountMinor} style={planRowText.value} />
          )
        }
        note={<Text style={planRowText.note}>{`Target ${formatMoney(goal.targetAmountMinor)}`}</Text>}
        progress={
          hideAmounts
            ? undefined
            : { pct: fillPct, color: theme.colors.incomeText, animKey: `goal:${goal.id}` }
        }
        trailing={action}
        divider={divider}
        onPress={onPress}
      />
    );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        compact && styles.compactRow,
        divider && styles.divider,
        goal.archived && shared.cardArchived,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.main}>
        {compact ? (
          <View style={styles.compactFields}>
            <View style={styles.compactName}>
              <Text style={styles.name}>{goal.name}</Text>
              {status}
            </View>
            <View style={styles.compactFigures}>
              {amount}
              <Text style={styles.compactTarget}>Target {formatMoney(goal.targetAmountMinor)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.top}>
            <Text style={styles.name}>{goal.name}</Text>
            <Text style={styles.amounts}>
              {amount}
              <Text style={styles.of}> / {formatMoney(goal.targetAmountMinor)}</Text>
            </Text>
          </View>
        )}
        {(!compact || !hideAmounts) && (
          <View
            style={[styles.track, compact && styles.compactTrack]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View
              style={[
                styles.fill,
                {
                  width: `${fillPct}%`,
                  backgroundColor: compact ? theme.colors.incomeText : theme.colors.ink,
                },
              ]}
            />
          </View>
        )}
        {!compact && status}
        {blocked && (
          <Text style={styles.line}>
            Linked account unavailable. Edit this goal to choose another account.
          </Text>
        )}
      </View>
      {action}
    </Pressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingLeft: 14,
      paddingRight: 8,
    },
    disc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    compactRow: { paddingVertical: 9, gap: 6 },
    compactFields: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      columnGap: 8,
      rowGap: 4,
    },
    compactName: { flexBasis: 110, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 },
    compactFigures: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '100%', marginStart: 'auto', gap: 2 },
    compactTarget: {
      textAlign: 'right',
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textMuted,
      fontVariant: ['tabular-nums'],
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
    name: { flexShrink: 1, fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
    amounts: { flexShrink: 1 },
    saved: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 15,
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
    compactTrack: { height: 3 },
    fill: { height: '100%', borderRadius: 3 },
    bottom: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8 },
    line: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
    pace: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12 },
    onPace: { color: theme.colors.incomeText },
    behind: { color: theme.colors.warnInk },
    // A 44 dp touch area around a 32 dp circle.
    hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    circlePressed: { opacity: theme.opacity.pressed },
    blocked: { opacity: theme.opacity.disabled },
  })
);
