import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { GoalSheetCard } from './GoalSheetCard';
import { GoalDetailModal } from './GoalDetailModal';
import { ContributeModal } from './ContributeModal';
import { goalPlan, GOAL_PACE_LABEL } from './goalPlan';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { toLocalIsoDate } from '@/lib/date';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
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
  onChanged: () => void;
  onMoveMoney: (accountId: string) => void;
}) {
  const [page, setPage] = useState<'overview' | 'edit' | 'contribute'>('overview');
  const { hideAmounts } = usePrivacy();
  const moving = useRef(false);
  const plan = goalPlan(goal, toLocalIsoDate(new Date()));
  const { done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const following = goal.tracksAccount;
  const account = accounts.find((a) => a.id === goal.linkedAccountId && !a.archived);
  const changed = () => {
    setPage('overview');
    onChanged();
  };
  return (
    <>
      <ModalSheet
        visible={page === 'overview'}
        title="Goal overview"
        onClose={onClose}
        footer={
          <View style={styles.actions}>
            <PrimaryButton title="Edit goal" variant="secondary" onPress={() => setPage('edit')} />
            {!goal.archived && (
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
            )}
          </View>
        }
      >
        <GoalSheetCard
          name={goal.name}
          savedMinor={goal.currentAmountMinor}
          targetMinor={goal.targetAmountMinor}
          targetDate={goal.targetDate}
        />
        <View style={styles.card}>
          <Text style={styles.caption}>Remaining</Text>
          <Text style={styles.value}>{formatMaskableMoney(plan.toGoMinor, { masked: hideAmounts })}</Text>
          {!hideAmounts && done && <Text style={styles.caption}>Target reached</Text>}
          {!hideAmounts && plan.pace && <Text style={styles.caption}>{GOAL_PACE_LABEL[plan.pace]}</Text>}
          {!hideAmounts && plan.perMonthMinor != null && (
            <Text style={styles.caption}>{formatMoney(plan.perMonthMinor)} a month to stay on pace</Text>
          )}
          {!hideAmounts && plan.pastDue && <Text style={styles.caption}>Past its target date</Text>}
        </View>
        <View style={styles.card}>
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
        {!hideAmounts && goal.letterRevealed && goal.noteToSelf && (
          <View style={styles.card}>
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
    </>
  );
}
const styles = StyleSheet.create({
  actions: { gap: 8 },
  card: { padding: 14, gap: 6, backgroundColor: theme.colors.surface, borderRadius: 22, marginBottom: 12 },
  caption: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  account: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  value: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
});
