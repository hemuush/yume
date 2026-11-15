import type { BudgetProgress } from '@/db/budgets';
import { createValueStore, useStoreValue } from '@/lib/valueStore';

/** Which of the Budgets page's sheets are open, and for what. */
export interface BudgetsSheetsState {
  /** The budget whose detail is open. */
  detailId: string | null;
  /** The budget form: a new budget (`editing` null) or the limit of one. */
  form: { editing: BudgetProgress | null } | null;
  /** The budget whose "Edit limit / Delete" menu is open. */
  manage: BudgetProgress | null;
}

const CLOSED: BudgetsSheetsState = { detailId: null, form: null, manage: null };

/**
 * The Budgets page's sheets, kept outside React state: opening or closing one redraws the sheets alone, not the hero and
 * the rows behind them.
 */
export function createBudgetsSheets() {
  const store = createValueStore(CLOSED);
  const set = (next: Partial<BudgetsSheetsState>) => store.set((prev) => ({ ...prev, ...next }));
  return {
    get: store.get,
    subscribe: store.subscribe,
    openDetail: (id: string) => set({ detailId: id }),
    closeDetail: () => set({ detailId: null }),
    /** The budget form; pass a budget to change its limit. */
    openForm: (editing: BudgetProgress | null = null) => set({ form: { editing } }),
    closeForm: () => set({ form: null }),
    openManage: (progress: BudgetProgress) => set({ manage: progress }),
    closeManage: () => set({ manage: null }),
  };
}

export type BudgetsSheets = ReturnType<typeof createBudgetsSheets>;

export function useBudgetsSheets(sheets: BudgetsSheets): BudgetsSheetsState {
  return useStoreValue(sheets);
}
