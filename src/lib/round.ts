/**
 * Rounding parts alone misleads beside their total: 3 x 10.40 renders "10 + 10 + 10 = 31". Render-path only.
 * `allocateRoundedMinor` rounds each part to whole major units summing exactly to the rounded total.
 */

/** Round to the nearest whole unit, half away from zero — matching how
 *  `Intl.NumberFormat` (and therefore `formatMoney`) rounds for display. */
function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * Canonical reduction of one exact minor-unit amount to the whole-rupee minor value it is displayed as.
 * Build derived figures (net, surplus) by combining `roundedMinor` parts, not rounding the exact total.
 */
export function roundedMinor(minor: number): number {
  // `|| 0` normalises a `-0` result (from rounding a small negative toward
  // zero) to plain `0`.
  return roundHalfAwayFromZero(minor / 100) * 100 || 0;
}

/**
 * Rounds a list of exact minor-unit amounts to whole-rupee values (multiples of 100) summing exactly to the
 * rounded total (or explicit `total`, e.g. a stored EMI). Handles mixed signs; whole input returns unchanged.
 */
export function allocateRoundedMinor(partsMinor: number[], totalMinor?: number): number[] {
  if (partsMinor.length === 0) return [];

  const exactTotal = totalMinor ?? partsMinor.reduce((sum, p) => sum + p, 0);
  const targetRupees = roundHalfAwayFromZero(exactTotal / 100);

  // Floor toward -infinity so remainders lie in [0, 1); the residue is then a non-negative count of whole
  // rupees to hand out (rarely negative: claw back when the rounded total is below the sum of the floors).
  const base = partsMinor.map((p) => Math.floor(p / 100));
  const frac = partsMinor.map((p, i) => p / 100 - base[i]);
  let residue = targetRupees - base.reduce((sum, b) => sum + b, 0);

  const order = partsMinor.map((_, i) => i);

  if (residue > 0) {
    // Largest fractional remainder first; stable on ties via original index.
    order.sort((a, b) => frac[b] - frac[a] || a - b);
    for (let k = 0; k < residue; k++) base[order[k % order.length]] += 1;
  } else if (residue < 0) {
    order.sort((a, b) => frac[a] - frac[b] || a - b);
    for (let k = 0; k < -residue; k++) base[order[k % order.length]] -= 1;
  }

  return base.map((b) => b * 100);
}
