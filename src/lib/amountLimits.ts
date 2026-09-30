/**
 * The largest single amount Yume accepts: 12 whole digits, far past any real
 * balance. Stored totals are SUMs of integer minor units, and JS integers are
 * only exact up to 2^53 (~9e15), so one unbounded entry — a long typed number,
 * or 999999999 × 999999999 on the Add pad — would silently corrupt every total
 * it touches. At this ceiling ~90 maximum-size rows would still sum exactly.
 */
export const MAX_AMOUNT_MAJOR = 999_999_999_999;
export const MAX_AMOUNT_MINOR = MAX_AMOUNT_MAJOR * 100;
