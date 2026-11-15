import type { Loan } from '@/types';
import { createValueStore, useStoreValue } from '@/lib/valueStore';

/** Which of the Loans page's sheets are open. */
export interface LoansSheetsState {
  /** The new-loan form. */
  adding: boolean;
  /** The loan whose detail is open. */
  loan: Loan | null;
  /** The detail opens on its pay sheet. */
  payOnOpen: boolean;
}

const CLOSED: LoansSheetsState = { adding: false, loan: null, payOnOpen: false };

/**
 * The Loans page's sheets, kept outside React state: opening or closing one redraws the sheets alone, not the cards,
 * the hero and the timeline behind them.
 */
export function createLoansSheets() {
  const store = createValueStore(CLOSED);
  const set = (next: Partial<LoansSheetsState>) => store.set((prev) => ({ ...prev, ...next }));
  return {
    get: store.get,
    subscribe: store.subscribe,
    /** A loan's detail (null puts it away); `pay` opens it on the pay sheet. */
    show: (loan: Loan | null, pay = false) => set({ loan, payOnOpen: pay }),
    openLoan: (loan: Loan) => set({ loan, payOnOpen: false }),
    payLoan: (loan: Loan) => set({ loan, payOnOpen: true }),
    closeLoan: () => set({ loan: null, payOnOpen: false }),
    openAdd: () => set({ adding: true }),
    closeAdd: () => set({ adding: false }),
  };
}

export type LoansSheets = ReturnType<typeof createLoansSheets>;

export function useLoansSheets(sheets: LoansSheets): LoansSheetsState {
  return useStoreValue(sheets);
}
