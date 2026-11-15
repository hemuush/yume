import type { SubscriptionSuggestion } from '@/db/subscriptions';
import { createValueStore, useStoreValue } from '@/lib/valueStore';
import type { RecurringRule } from '@/types';

/** Which of the Recurring page's sheets are open, and for what. */
export interface RecurringSheetsState {
  /** The rule being edited. */
  rule: RecurringRule | null;
  /** The form for a new rule. */
  adding: boolean;
  /** "Make recurring" on a suggestion: the form, filled in from it. */
  suggestion: SubscriptionSuggestion | null;
  /** The new-account form (a rule needs an account). */
  accountForm: boolean;
  /** A day of the 30-day strip, whose entries are listed. */
  runDate: string | null;
}

const CLOSED: RecurringSheetsState = {
  rule: null,
  adding: false,
  suggestion: null,
  accountForm: false,
  runDate: null,
};

/**
 * The Recurring page's sheets, kept outside React state: opening or closing one redraws the sheets alone, not the hero
 * and the rules behind them.
 */
export function createRecurringSheets() {
  const store = createValueStore(CLOSED);
  const set = (next: Partial<RecurringSheetsState>) => store.set((prev) => ({ ...prev, ...next }));
  return {
    get: store.get,
    subscribe: store.subscribe,
    openRule: (rule: RecurringRule) => set({ rule }),
    openAdd: () => set({ adding: true }),
    fromSuggestion: (suggestion: SubscriptionSuggestion) => set({ suggestion }),
    /** The rule form is put away, whichever way it was opened. */
    closeForm: () => set({ rule: null, adding: false, suggestion: null }),
    /** The rule being edited is gone (deleted): only its form closes. */
    closeEditing: () => set({ rule: null }),
    openAccountForm: () => set({ accountForm: true }),
    closeAccountForm: () => set({ accountForm: false }),
    openRunDate: (date: string) => set({ runDate: date }),
    closeRunDate: () => set({ runDate: null }),
    /** A rule picked from a day's list opens its form in place of the list. */
    editFromRunDate: (rule: RecurringRule) => set({ runDate: null, rule }),
  };
}

export type RecurringSheets = ReturnType<typeof createRecurringSheets>;

export function useRecurringSheets(sheets: RecurringSheets): RecurringSheetsState {
  return useStoreValue(sheets);
}
