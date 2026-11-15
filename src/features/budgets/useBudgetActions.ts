import { useCallback, useEffect, useRef, useState } from 'react';
import { showAlert } from '@/components/AppDialog';
import { useUndoToast } from '@/components/UndoToast';
import {
  createBudget,
  deleteBudget,
  restoreBudget,
  type BudgetProgress,
  type LapsedBudget,
} from '@/db/budgets';
import { categoryPath } from '@/lib/categoryLabel';
import { errorMessage } from '@/lib/errorMessage';
import { haptics } from '@/lib/haptics';
import { continueBudgets } from './continueBudgets';

/**
 * What the Budgets page does to budgets outside their forms: continuing a lapsed budget (one or all) into this month,
 * and deleting one with an undo. One of them runs at a time (a double tap never fires twice), and nothing lands after
 * the page is gone. The functions keep their identity, so the rows and sheets that hold them are not redrawn for them.
 */
export function useBudgetActions({
  periodMonth,
  lapsed,
  reload,
}: {
  periodMonth: string;
  lapsed: LapsedBudget[];
  reload: () => Promise<void>;
}) {
  const { show: showUndo } = useUndoToast();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [continuingAll, setContinuingAll] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // "Continue all" reads the list as it is when pressed, without taking a new identity with every load.
  const lapsedNow = useRef(lapsed);
  useEffect(() => {
    lapsedNow.current = lapsed;
  });

  const onContinue = useCallback(
    async (item: LapsedBudget) => {
      if (!mounted.current || running.current) return;
      running.current = true;
      setContinuingId(item.categoryId);
      try {
        await createBudget({
          categoryId: item.categoryId,
          limitAmountMinor: item.limitAmountMinor,
          rollover: item.rollover,
          periodMonth,
        });
        if (!mounted.current) return;
        haptics.tap();
        await reload();
      } catch (e) {
        // The category stays in the list to try again; say why this attempt didn't take.
        if (mounted.current) showAlert('Couldn’t continue budget', errorMessage(e));
      } finally {
        running.current = false;
        if (mounted.current) setContinuingId(null);
      }
    },
    [periodMonth, reload]
  );

  const onContinueAll = useCallback(async () => {
    if (!mounted.current || running.current) return;
    running.current = true;
    setContinuingAll(true);
    try {
      const failures = await continueBudgets(lapsedNow.current, periodMonth);
      if (!mounted.current) return;
      haptics.tap();
      await reload();
      if (failures.length) showAlert('Some budgets couldn’t continue', failures.join('\n'));
    } finally {
      running.current = false;
      if (mounted.current) setContinuingAll(false);
    }
  }, [periodMonth, reload]);

  const onDelete = useCallback(
    async (progress: BudgetProgress) => {
      if (!mounted.current || running.current) return;
      running.current = true;
      setDeleteBusy(true);
      let deleted = false;
      try {
        const snapshot = await deleteBudget(progress.budget.id);
        deleted = true;
        if (!mounted.current) return;
        haptics.warn();
        showUndo(`Deleted "${categoryPath(progress.categoryName, progress.parentName)}" budget`, async () => {
          await restoreBudget(snapshot);
          if (mounted.current) {
            try {
              await reload();
            } catch {
              showAlert(
                'Budget restored',
                'The budget was restored, but the list could not refresh. Reopen Budgets to see it.'
              );
            }
          }
        });
        await reload();
      } catch (e) {
        if (mounted.current)
          showAlert(
            deleted ? 'Budget deleted' : 'Couldn’t delete budget',
            deleted
              ? 'The budget was deleted, but the list could not refresh. Reopen Budgets to see it.'
              : errorMessage(e)
          );
      } finally {
        running.current = false;
        if (mounted.current) setDeleteBusy(false);
      }
    },
    [reload, showUndo]
  );

  /** Whether one of the actions is running: a row does not open while it is. */
  const isBusy = useCallback(() => running.current, []);
  return {
    busy: deleteBusy || continuingAll || continuingId !== null,
    continuingId,
    continuingAll,
    onContinue,
    onContinueAll,
    onDelete,
    isBusy,
  };
}
