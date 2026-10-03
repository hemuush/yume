/**
 * Largest single amount Yume accepts: 12 whole digits. Totals are SUMs of integer minor units, exact only to
 * 2^53 (~9e15), so one unbounded entry would corrupt every total; ~90 max-size rows still sum exactly.
 */
export const MAX_AMOUNT_MAJOR = 999_999_999_999;
export const MAX_AMOUNT_MINOR = MAX_AMOUNT_MAJOR * 100;
