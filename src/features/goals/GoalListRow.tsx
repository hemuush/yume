import { memo } from 'react';
import { MovingRow } from '@/components/MovingRow';
import type { Account, SavingsGoal } from '@/types';
import { GoalCard } from './GoalCard';

/**
 * One goal in the list, with the account it follows or reserves in. It is drawn again only when its own goal (or that
 * account, or its colour or place) changes, not for a sheet opening or another goal changing. `onOpen` and
 * `onContribute` are one function for every row (each is handed the goal).
 */
export const GoalListRow = memo(function GoalListRow({
  goal,
  divider,
  account,
  onOpen,
  onContribute,
}: {
  goal: SavingsGoal;
  divider: boolean;
  /** The account the goal is linked to, when it has one. */
  account?: Account;
  onOpen: (goal: SavingsGoal) => void;
  onContribute: (goal: SavingsGoal) => void;
}) {
  return (
    <MovingRow>
      <GoalCard
        goal={goal}
        divider={divider}
        accountName={account?.name}
        accountAvailable={!!account && !account.archived}
        onPress={() => onOpen(goal)}
        onContribute={() => onContribute(goal)}
      />
    </MovingRow>
  );
});
