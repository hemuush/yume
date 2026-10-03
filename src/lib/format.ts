/**
 * Caps period-over-period percentage changes everywhere the same way: a near-empty prior period gives a
 * correct but unreadable number like "3116%" that would overflow some screens.
 */
export function formatPctChange(pct: number): string {
  const abs = Math.abs(pct);
  return abs > 999 ? '>999%' : `${Math.round(abs)}%`;
}

/**
 * A plain 0-100 ratio (loan payoff share, budget spent share), distinct from `formatPctChange`, which caps
 * noisy period-over-period changes. Never negative or >100, so don't couple it to the change-capping rule.
 */
export function formatRatioPct(fraction0to1: number): string {
  return `${Math.round(fraction0to1 * 100)}%`;
}
