// Savings rate = `(income − expense) ÷ income`, NOT `net ÷ income` (net also subtracts transfers into
// savings accounts, so heavy savers would read 0%). Money kept is money saved either way.

/** Raw percentage. Can be negative (spent more than earned) or huge. */
export function savingsRatePct(savedMinor: number, incomeMinor: number): number {
  return incomeMinor > 0 ? (savedMinor / incomeMinor) * 100 : 0;
}

/** Display label — collapses the extremes so the text stays legible. */
export function savingsRateLabel(pct: number): string {
  if (pct > 999) return '>999%';
  if (pct < -999) return '<-999%';
  return `${Math.round(pct)}%`;
}
