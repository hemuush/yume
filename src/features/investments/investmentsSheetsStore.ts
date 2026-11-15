import type { Account, RecurringRule } from '@/types';
import { createValueStore, useStoreValue } from '@/lib/valueStore';

/** Which of the Investments page's sheets are open, and for what. */
export interface InvestmentsSheetsState {
  /** The holding whose summary is open. */
  summary: Account | null;
  /** The holding being edited. */
  editing: Account | null;
  /** The new-investment form. */
  adding: boolean;
  /** The sheet that updates every holding's value. */
  updating: boolean;
  /** The list that asks which holding an investment or a SIP is for. */
  picking: 'invest' | 'sip' | null;
  /** The SIP form: an existing one to edit, or a new one for `holding`. */
  rule: { editing: RecurringRule | null; holding: Account | null } | null;
}

const CLOSED: InvestmentsSheetsState = {
  summary: null,
  editing: null,
  adding: false,
  updating: false,
  picking: null,
  rule: null,
};

/**
 * The Investments page's sheets, kept outside React state: opening or closing one redraws the sheets alone, not the
 * totals, the chart and the rows behind them.
 */
export function createInvestmentsSheets() {
  const store = createValueStore(CLOSED);
  const set = (next: Partial<InvestmentsSheetsState>) => store.set((prev) => ({ ...prev, ...next }));
  return {
    get: store.get,
    subscribe: store.subscribe,
    openSummary: (summary: Account) => set({ summary }),
    closeSummary: () => set({ summary: null }),
    edit: (editing: Account | null) => set({ editing }),
    openAdd: () => set({ adding: true }),
    closeAdd: () => set({ adding: false }),
    openUpdate: () => set({ updating: true }),
    closeUpdate: () => set({ updating: false }),
    pick: (picking: 'invest' | 'sip' | null) => set({ picking }),
    /** The SIP form for a new SIP into `holding`. */
    startSip: (holding: Account) => set({ rule: { editing: null, holding } }),
    /** The SIP form on an existing SIP. */
    editSip: (editing: RecurringRule) => set({ rule: { editing, holding: null } }),
    closeRule: () => set({ rule: null }),
  };
}

export type InvestmentsSheets = ReturnType<typeof createInvestmentsSheets>;

export function useInvestmentsSheets(sheets: InvestmentsSheets): InvestmentsSheetsState {
  return useStoreValue(sheets);
}
