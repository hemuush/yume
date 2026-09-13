/**
 * A near-empty prior period (a category with almost no spend last month, a
 * month freshly backfilled with only a couple of entries so far) turns an
 * ordinary percentage change into a mathematically correct but unreadable
 * number like "3116%". Every place in the app that shows a period-over-period
 * percentage change caps it the same way, rather than letting a handful of
 * screens overflow with digits while others don't.
 */
export function formatPctChange(pct: number): string {
  const abs = Math.abs(pct);
  return abs > 999 ? '>999%' : `${Math.round(abs)}%`;
}

/**
 * A plain 0-100 ratio (a loan's payoff share, a budget's spent share) —
 * distinct from `formatPctChange` above, which exists specifically to cap a
 * noisy *period-over-period change* like "3116%". A ratio like this is
 * never negative or over 100, so it never needs that capping; using
 * `formatPctChange` for it anyway would be an accidental coupling that a
 * future tweak to the change-capping rule could silently bleed into.
 */
export function formatRatioPct(fraction0to1: number): string {
  return `${Math.round(fraction0to1 * 100)}%`;
}
