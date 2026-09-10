// Savings rate = how much of this period's income is still uncommitted,
// i.e. `net ÷ income`. `netMinor` from a PeriodSummary already excludes money
// moved into savings-type accounts this period (see src/db/reports.ts), so
// this reads as "% of income kept / not yet spent", not "% saved in total".
//
// This logic previously lived only inside app/(tabs)/reports.tsx; it's pulled
// here so the Home screen's savings bar and the Reports ring compute it the
// exact same way. Pure — no behaviour change to any existing figure.

/** Raw percentage. Can be negative, or absurd (e.g. -4280%) from a one-off expense. */
export function savingsRatePct(netMinor: number, incomeMinor: number): number {
  return incomeMinor > 0 ? (netMinor / incomeMinor) * 100 : 0;
}

/**
 * Clamped to [-100, 100] for anything that draws the rate to scale (a bar
 * fill, a ring sweep) — an unclamped four-digit percentage is unreadable.
 */
export function clampSavingsRate(pct: number): number {
  return Math.max(-100, Math.min(100, pct));
}

/** Display label — collapses the extremes so the text stays legible. */
export function savingsRateLabel(pct: number): string {
  if (pct > 999) return '>999%';
  if (pct < -999) return '<-999%';
  return `${Math.round(pct)}%`;
}
