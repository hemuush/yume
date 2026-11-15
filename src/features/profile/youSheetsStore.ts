import type { Account } from '@/types';
import { createValueStore, useStoreValue } from '@/lib/valueStore';

/** Which of the You page's sheets are open. */
export interface YouSheetsState {
  /** The new-account form. */
  adding: boolean;
  /** The account whose details are open. */
  account: Account | null;
}

const CLOSED: YouSheetsState = { adding: false, account: null };

/**
 * The You page's sheets, kept outside React state: opening or closing one redraws the sheets alone, not the cards and
 * tiles behind them.
 */
export function createYouSheets() {
  const store = createValueStore(CLOSED);
  const set = (next: Partial<YouSheetsState>) => store.set((prev) => ({ ...prev, ...next }));
  return {
    get: store.get,
    subscribe: store.subscribe,
    openAdd: () => set({ adding: true }),
    closeAdd: () => set({ adding: false }),
    openAccount: (account: Account) => set({ account }),
    closeAccount: () => set({ account: null }),
  };
}

export type YouSheets = ReturnType<typeof createYouSheets>;

export function useYouSheets(sheets: YouSheets): YouSheetsState {
  return useStoreValue(sheets);
}
