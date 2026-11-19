import { Fragment, memo } from 'react';
import { MovingRow } from '@/components/MovingRow';
import type { BudgetProgress } from '@/db/budgets';
import { BudgetRow } from './BudgetRow';

/** One budget in the list. It compares its props by identity, so a reload redraws only the budgets that changed. */
export const BudgetListRow = memo(function BudgetListRow({
  progress,
  divider,
  onOpen,
  onMore,
  compact,
}: {
  progress: BudgetProgress;
  divider: boolean;
  onOpen: (id: string) => void;
  onMore: (progress: BudgetProgress) => void;
  compact?: boolean;
}) {
  const RowContainer = compact ? Fragment : MovingRow;
  return (
    <RowContainer>
      <BudgetRow
        compact={compact}
        progress={progress}
        divider={divider}
        showPerDay
        onPress={() => onOpen(progress.budget.id)}
        onMore={() => onMore(progress)}
      />
    </RowContainer>
  );
});
