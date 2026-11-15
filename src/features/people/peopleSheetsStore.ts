import type { PersonWithBalance } from '@/db/people';
import { createValueStore, useStoreValue } from '@/lib/valueStore';

/** Which of the Friends & family page's sheets are open. */
export interface PeopleSheetsState {
  /** The new-person form. */
  adding: boolean;
  /** The person whose sheet is open. */
  person: PersonWithBalance | null;
}

const CLOSED: PeopleSheetsState = { adding: false, person: null };

/**
 * The Friends & family page's sheets, kept outside React state: opening or closing one redraws the sheets alone, not the
 * summary, the tiles and the header behind them.
 */
export function createPeopleSheets() {
  const store = createValueStore(CLOSED);
  const set = (next: Partial<PeopleSheetsState>) => store.set((prev) => ({ ...prev, ...next }));
  return {
    get: store.get,
    subscribe: store.subscribe,
    openPerson: (person: PersonWithBalance) => set({ person }),
    closePerson: () => set({ person: null }),
    openAdd: () => set({ adding: true }),
    closeAdd: () => set({ adding: false }),
  };
}

export type PeopleSheets = ReturnType<typeof createPeopleSheets>;

export function usePeopleSheets(sheets: PeopleSheets): PeopleSheetsState {
  return useStoreValue(sheets);
}
