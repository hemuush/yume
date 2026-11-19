import { useSyncExternalStore } from 'react';
import { showAlert } from '@/components/AppDialog';
import { getLoanPaymentContext, type LoanPaymentContext } from '@/db/loans';
import { errorMessage } from '@/lib/errorMessage';
import type { Transaction } from '@/types';

export type PlanDetailKind =
  | 'loan'
  | 'budget'
  | 'person'
  | 'goal'
  | 'new-goal'
  | 'new-budget'
  | 'new-account'
  | 'new-investment'
  | 'new-rule'
  | 'new-loan'
  | 'rule';

/** Which of Plan's sheets are open, and for what. */
export interface PlanSheetsState {
  /** An item's detail, or a form to add one. */
  detail: { kind: PlanDetailKind; id: string } | null;
  /** An entry opened from the pending refunds. */
  refundTx: Transaction | null;
  /** The EMI being paid from Coming up, with the account and category it goes on. */
  paying: LoanPaymentContext | null;
  /** "Add to your plan". */
  creationMenu: boolean;
  /** The loan comparison. */
  comparisonOpen: boolean;
}

const CLOSED: PlanSheetsState = {
  detail: null,
  refundTx: null,
  paying: null,
  creationMenu: false,
  comparisonOpen: false,
};

/**
 * Plan's sheets, kept outside React state: opening or closing one then redraws the sheets alone, not the whole page behind
 * them. One thing is open at a time among a detail, a refund's entry and a payment: opening one puts the others away, and
 * a payment lookup still in flight never covers a detail opened after it.
 */
export function createPlanSheets() {
  let state = CLOSED;
  const listeners = new Set<() => void>();
  const set = (next: Partial<PlanSheetsState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  let ticket = 0;
  let paymentBusy = false;
  const cancelPayment = () => {
    ticket++;
    paymentBusy = false;
  };
  const openDetail = (kind: PlanDetailKind, id: string) => {
    cancelPayment();
    set({ paying: null, refundTx: null, detail: { kind, id } });
  };
  return {
    get: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openDetail,
    closeDetail: () => set({ detail: null }),
    openRefund: (tx: Transaction) => {
      cancelPayment();
      set({ paying: null, detail: null, refundTx: tx });
    },
    closeRefund: () => set({ refundTx: null }),
    /** Opens the payment sheet for a loan's due installment, once the account and category it goes on are known. */
    payEmi: async (loanId: string) => {
      if (paymentBusy) return;
      paymentBusy = true;
      const mine = ++ticket;
      set({ detail: null, refundTx: null });
      try {
        const context = await getLoanPaymentContext(loanId);
        if (mine !== ticket) return;
        if (context) set({ paying: context });
        else showAlert('Nothing to pay', 'This loan has no installment due right now.');
      } catch (e) {
        if (mine === ticket) showAlert('Couldn’t open the payment', errorMessage(e));
      } finally {
        if (mine === ticket) paymentBusy = false;
      }
    },
    closePaying: () => set({ paying: null }),
    /** A payment lookup still in flight is dropped (leaving the page). */
    cancelPayment,
    openMenu: () => set({ creationMenu: true }),
    closeMenu: () => set({ creationMenu: false }),
    /** Picks an "Add to your plan" row: the menu closes and the form opens. */
    pickNew: (kind: PlanDetailKind) => {
      set({ creationMenu: false });
      openDetail(kind, '');
    },
    openComparison: () => set({ comparisonOpen: true }),
    closeComparison: () => set({ comparisonOpen: false }),
  };
}

export type PlanSheets = ReturnType<typeof createPlanSheets>;

export function usePlanSheets(sheets: PlanSheets): PlanSheetsState {
  return useSyncExternalStore(sheets.subscribe, sheets.get);
}
