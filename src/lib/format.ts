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
