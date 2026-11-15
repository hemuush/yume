import type { Category } from '@/types';
import { createValueStore, useStoreValue } from '@/lib/valueStore';

/** Which of the Categories page's sheets are open, and for what. */
export interface CategoriesSheetsState {
  /** The new-category form. */
  adding: boolean;
  /** The category being edited. */
  editing: Category | null;
  /**
   * The category the "manage" sheet is open for, and whether from the active or the archived section, which only changes
   * the two actions offered (Archive and Delete, or Restore and Delete).
   */
  manage: { cat: Category; archived: boolean } | null;
}

const CLOSED: CategoriesSheetsState = { adding: false, editing: null, manage: null };

/**
 * The Categories page's sheets, kept outside React state: opening or closing one redraws the sheets alone, not the tiles
 * behind them.
 */
export function createCategoriesSheets() {
  const store = createValueStore(CLOSED);
  const set = (next: Partial<CategoriesSheetsState>) => store.set((prev) => ({ ...prev, ...next }));
  return {
    get: store.get,
    subscribe: store.subscribe,
    openAdd: () => set({ adding: true }),
    closeAdd: () => set({ adding: false }),
    edit: (editing: Category | null) => set({ editing }),
    manage: (cat: Category, archived: boolean) => set({ manage: { cat, archived } }),
    closeManage: () => set({ manage: null }),
  };
}

export type CategoriesSheets = ReturnType<typeof createCategoriesSheets>;

export function useCategoriesSheets(sheets: CategoriesSheets): CategoriesSheetsState {
  return useStoreValue(sheets);
}
