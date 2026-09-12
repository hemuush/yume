// Savings rate = how much of this period's income you didn't spend, i.e.
// `(income − expense) ÷ income`. Note this is deliberately NOT `net ÷ income`
// (net also subtracts money moved into savings accounts, which would make
// someone who saves aggressively read as "0% saved"). Money kept is money
// saved, whether it's sitting in checking or was swept into a savings pot.
//
// Pure — no behaviour change to any existing stored figure.

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
