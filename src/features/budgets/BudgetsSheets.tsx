import { memo, useEffect, useMemo } from 'react';
import { ActionSheet, type ActionSheetItem } from '@/components/ActionSheet';
import type { BudgetProgress } from '@/db/budgets';
import { getCachedCurrency } from '@/db/settings';
import { categorySentence } from '@/lib/categoryLabel';
import type { Account, Category } from '@/types';
import { AddBudgetModal } from './AddBudgetModal';
import { BudgetDetailModal } from './BudgetDetailModal';
import { budgetCategories } from './budgetCategories';
import { useBudgetsSheets, type BudgetsSheets as BudgetsSheetsStore } from './budgetsSheetsStore';

/**
 * The sheets the Budgets page opens: a budget's detail, the form to add one or change a limit, and the "Edit limit /
 * Delete" menu. Which is open lives in `sheets`, so the page behind does not redraw when one opens or closes.
 */
export const BudgetsSheets = memo(function BudgetsSheets({
  sheets,
  budgets,
  categories,
  accounts,
  hideAmounts,
  ready,
  reload,
  onDelete,
  ledgerStyle,
}: {
  sheets: BudgetsSheetsStore;
  budgets: BudgetProgress[];
  categories: Category[];
  accounts: Account[];
  hideAmounts: boolean;
  /** The page has its budgets (so a detail whose budget is gone can be put away). */
  ready: boolean;
  /** Reloads the page in place after something was saved or deleted in a sheet. */
  reload: () => Promise<void>;
  onDelete: (progress: BudgetProgress) => void;
  ledgerStyle?: boolean;
}) {
  const { detailId, form, manage } = useBudgetsSheets(sheets);
  // Every expense category, parents and subcategories alike, for AddBudgetModal's picker; see that component's comment
  // for why it isn't pre-filtered to "no budget this month".
  const expenseCategories = useMemo(
    () => budgetCategories(categories, hideAmounts),
    [categories, hideAmounts]
  );
  const budgetedIds = useMemo(() => new Set(budgets.map((b) => b.budget.categoryId)), [budgets]);
  const detail = detailId ? budgets.find((b) => b.budget.id === detailId) : undefined;
  useEffect(() => {
    if (ready && detailId && !detail) sheets.closeDetail();
  }, [ready, detailId, detail, sheets]);

  const manageItems = useMemo<ActionSheetItem[]>(
    () =>
      manage
        ? [
            {
              key: 'edit',
              label: 'Edit limit',
              icon: 'edit-2',
              onPress: () => sheets.openForm(manage),
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: 'trash-2',
              destructive: true,
              onPress: () => onDelete(manage),
            },
          ]
        : [],
    [manage, sheets, onDelete]
  );

  return (
    <>
      <AddBudgetModal
        ledgerStyle={ledgerStyle}
        visible={form !== null}
        editing={form?.editing ?? null}
        categories={expenseCategories}
        budgetedCategoryIds={budgetedIds}
        onClose={sheets.closeForm}
        onSaved={async () => {
          sheets.closeForm();
          await reload();
        }}
      />
      {detail && (
        <BudgetDetailModal
          ledgerStyle={ledgerStyle}
          key={detail.budget.id}
          progress={detail}
          categories={categories}
          accounts={accounts}
          currency={getCachedCurrency()}
          onClose={sheets.closeDetail}
          onChanged={reload}
        />
      )}
      <ActionSheet
        ledgerStyle={ledgerStyle}
        visible={!!manage}
        onClose={sheets.closeManage}
        title={manage ? categorySentence(manage.categoryName, manage.parentName) : undefined}
        items={manageItems}
      />
    </>
  );
});
