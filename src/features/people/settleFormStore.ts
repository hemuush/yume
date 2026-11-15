import { toLocalIsoDate } from '@/lib/date';
import { createValueStore, useStoreValue } from '@/lib/valueStore';

/** What is typed and picked on a person's Settle page. */
export interface SettleFormState {
  amount: string;
  note: string;
  /** Defaults to today but stays editable, so catching up on a friend's expense from last week isn't misdated. */
  dateIso: string;
  /** The account the cash moved through; null when only the balance is adjusted. */
  accountId: string | null;
}

/**
 * The Settle form's fields, kept outside the sheet's state: a typed digit redraws the form, not the balance card, the tabs
 * and the footer around it. The footer's buttons read it at the moment of the tap.
 */
export function createSettleForm() {
  const store = createValueStore<SettleFormState>({
    amount: '',
    note: '',
    dateIso: toLocalIsoDate(new Date()),
    accountId: null,
  });
  const set = (next: Partial<SettleFormState>) => store.set((prev) => ({ ...prev, ...next }));
  return {
    get: store.get,
    subscribe: store.subscribe,
    setAmount: (amount: string) => set({ amount }),
    setNote: (note: string) => set({ note }),
    setDate: (dateIso: string) => set({ dateIso }),
    setAccount: (accountId: string | null) => set({ accountId }),
    /** After a saved entry: the amount and note are emptied, the date and account stay for the next one. */
    clear: () => set({ amount: '', note: '' }),
  };
}

export type SettleForm = ReturnType<typeof createSettleForm>;

export function useSettleForm(form: SettleForm): SettleFormState {
  return useStoreValue(form);
}
