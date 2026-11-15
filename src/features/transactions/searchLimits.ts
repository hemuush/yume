/** Below this, a query rarely narrows anything and firing on every keystroke of a short word is wasted work. */
export const SEARCH_MIN_CHARS = 2;

/**
 * Search spans the whole ledger, not one week/month — capped so a very common word doesn't dump years of history
 * into one scroll.
 */
export const SEARCH_RESULT_LIMIT = 50;
