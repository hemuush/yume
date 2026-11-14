import { useSyncExternalStore } from 'react';
import type { Account, Transaction } from '@/types';

/** Which of Home's sheets are open, and for what. */
export interface HomeSheetsState {
  /** The account whose summary is open. */
  account: Account | null;
  /** The account being edited (its summary hands over to the edit form). */
  editing: Account | null;
  /** The entry whose detail is open. */
  entry: Transaction | null;
  /** The new-account form is open. */
  adding: boolean;
}

const CLOSED: HomeSheetsState = { account: null, editing: null, entry: null, adding: false };

/**
 * Home's sheets, kept outside React state: opening or closing one then re-renders the sheets alone, not the whole page
 * behind them (the month card, the accounts, Coming up and Recent activity cost about 100 to 150 ms to redraw at 6
 * times slower CPU, for a sheet that covers them).
 */
export function createHomeSheets() {
  let state = CLOSED;
  const listeners = new Set<() => void>();
  const set = (next: Partial<HomeSheetsState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  return {
    get: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openAccount: (account: Account) => set({ account }),
    closeAccount: () => set({ account: null }),
    editAccount: (account: Account) => set({ account: null, editing: account }),
    closeEditing: () => set({ editing: null }),
    /** Opening an entry puts any account summary away first, as the entry is what was asked for. */
    openEntry: (entry: Transaction) => set({ account: null, entry }),
    closeEntry: () => set({ entry: null }),
    openAddAccount: () => set({ adding: true }),
    closeAddAccount: () => set({ adding: false }),
  };
}

export type HomeSheets = ReturnType<typeof createHomeSheets>;

export function useHomeSheets(sheets: HomeSheets): HomeSheetsState {
  return useSyncExternalStore(sheets.subscribe, sheets.get);
}
