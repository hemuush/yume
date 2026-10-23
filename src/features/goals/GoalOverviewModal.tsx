import { GoalHistory } from './GoalHistory';
import { SheetFlow } from '@/components/SheetFlow';
import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { GoalHero } from './GoalHero';
import { GoalDetailModal } from './GoalDetailModal';
import { ContributeModal } from './ContributeModal';
import { goalPlan, GOAL_PACE_LABEL } from './goalPlan';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { toLocalIsoDate } from '@/lib/date';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { dayMonthYear } from '@/lib/dateLabels';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';
import type { Account, SavingsGoal } from '@/types';

/** Read first; edit, contribute or transfer only after choosing an action. */
export function GoalOverviewModal({
  goal,
  accounts,
  onClose,
  onChanged,
  onMoveMoney,
}: {
  goal: SavingsGoal;
  accounts: Account[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onMoveMoney: (accountId: string) => void;
}) {
  const [page, setPage] = useState<'overview' | 'edit' | 'contribute'>('overview');
  const { hideAmounts } = usePrivacy();
  const { secondary } = useAccent();
  const moving = useRef(false);
  const plan = goalPlan(goal, toLocalIsoDate(new Date()));
  const { done, percent } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const following = goal.tracksAccount;
  const account = accounts.find((a) => a.id === goal.linkedAccountId && !a.archived);
  const changed = async () => {
    setPage('overview');
    await onChanged();
  };
  return (
    <SheetFlow>
      <ModalSheet
        flowPage
        visible={page === 'overview'}
        title="Goal overview"
        onClose={onClose}
        footer={
          <View style={styles.actions}>
            <View style={styles.edit}>
              <PrimaryButton title="Edit goal" variant="secondary" onPress={() => setPage('edit')} />
            </View>
            {!goal.archived && (
              <View style={styles.main}>
                <PrimaryButton
                  title={following ? 'Move money' : goal.reservesAccount ? 'Reserve / release' : 'Add money'}
                  disabled={following && !account}
                  onPress={() => {
                    if (following) {
                      if (account && !moving.current) {
                        moving.current = true;
                        onMoveMoney(account.id);
                      }
                    } else setPage('contribute');
                  }}
                />
              </View>
            )}
          </View>
        }
      >
        <GoalHero
          hue={done && !hideAmounts ? theme.colors.flatLime : secondary}
          icon={done && !hideAmounts ? 'flag-checkered' : 'piggy-bank-outline'}
          name={goal.name}
          kicker={
            hideAmounts
              ? `Savings goal · of ${formatMoney(goal.targetAmountMinor)}`
              : done
                ? 'Savings goal · Reached'
                : `Savings goal · ${Math.round(percent)}% of ${formatMoney(goal.targetAmountMinor)}`
          }
          saved={formatMaskableMoney(goal.currentAmountMinor, { masked: hideAmounts })}
          fraction={hideAmounts ? 0 : percent / 100}
          toGo={hideAmounts ? undefined : done ? { reached: true } : { figure: formatMoney(plan.toGoMinor) }}
          date={!hideAmounts && goal.targetDate ? dayMonthYear(goal.targetDate) : undefined}
          status={
            hideAmounts
              ? undefined
              : [plan.pace && GOAL_PACE_LABEL[plan.pace], plan.pastDue && 'Past its date']
                  .filter(Boolean)
                  .join(' · ') || undefined
          }
          perMonth={
            !hideAmounts && plan.perMonthMinor != null
              ? `${formatMoney(plan.perMonthMinor)} a month to stay on pace`
              : undefined
          }
        />
        <View style={styles.note}>
          <Text style={styles.caption}>
            {following
              ? 'Following account'
              : goal.reservesAccount
                ? 'Reserved from account'
                : 'Progress added by hand'}
          </Text>
          {(goal.linkedAccountId || following) && (
            <Text style={styles.account}>{account?.name ?? 'Linked account unavailable'}</Text>
          )}
          <Text style={styles.caption}>
            {following
              ? account
                ? 'Progress follows this account’s balance. Move money to this account to update it.'
                : 'Edit the goal to choose an available account before moving money.'
              : goal.reservesAccount
                ? 'Manage reserved money without creating a new bank transfer.'
                : 'Adding money updates goal progress; it does not create a bank transfer.'}
          </Text>
        </View>
        <GoalHistory
          key={`${goal.id}:${goal.currentAmountMinor}:${goal.reservedAmountMinor}`}
          goalId={goal.id}
          refreshToken={goal}
        />
        {!hideAmounts && goal.letterRevealed && goal.noteToSelf && (
          <View style={styles.note}>
            <Text style={styles.caption}>Why you started this</Text>
            <Text style={styles.caption}>{goal.noteToSelf}</Text>
          </View>
        )}
      </ModalSheet>
      {page === 'edit' && (
        <GoalDetailModal
          goal={goal}
          accounts={accounts}
          backLabel="Back to goal overview"
          onClose={() => setPage('overview')}
          onChanged={changed}
          onRefresh={onChanged}
        />
      )}
      {page === 'contribute' && (
        <ContributeModal
          goal={goal}
          backLabel="Back to goal overview"
          onClose={() => setPage('overview')}
          onContributed={changed}
        />
      )}
    </SheetFlow>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  edit: { flexGrow: 1, flexBasis: 100 },
  main: { flexGrow: 1.6, flexBasis: 160 },
  note: { paddingHorizontal: 2, paddingVertical: 8, gap: 4, marginBottom: 6 },
  caption: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  account: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
});
