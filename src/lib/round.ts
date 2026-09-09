/**
 * Showing a set of amounts next to their total is misleading when each is
 * rounded to whole currency units on its own: 10.40 + 10.40 + 10.40 renders
 * as "10 + 10 + 10 = 31". `allocateRoundedMinor` rounds every part to a whole
 * major unit (a multiple of 100 minor units) such that the parts still sum
 * *exactly* to the rounded total — the classic largest-remainder (Hamilton)
 * apportionment.
 *
 * All money in the app is stored and computed in exact integer minor units;
 * this helper lives purely in the render path, so the internal invariants
 * (a loan's principal components summing to its principal, a period's
 * income − expense − savings equalling its net, …) are untouched. It only
 * decides how the unavoidable sub-unit rounding is distributed on screen so
 * the visible numbers reconcile.
 */

/** Round to the nearest whole unit, half away from zero — matching how
 *  `Intl.NumberFormat` (and therefore `formatMoney`) rounds for display. */
function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * The one canonical way to reduce a single exact minor-unit amount to the
 * whole-rupee minor value it is displayed as. Use it wherever a *derived*
 * on-screen figure (a net, a surplus, an equity, a running total) must be
 * built from the same rounded numbers the user sees for its parts — compute
 * each part with `roundedMinor` and combine those, rather than rounding the
 * exact total separately, so the arithmetic on screen always holds.
 */
export function roundedMinor(minor: number): number {
  // `|| 0` normalises a `-0` result (from rounding a small negative toward
  // zero) to plain `0`.
  return roundHalfAwayFromZero(minor / 100) * 100 || 0;
}

/**
 * Given a list of exact minor-unit amounts (and optionally an explicit exact
 * total they should reconcile to — e.g. a stored EMI that the principal and
 * interest components must add up to), return the same number of values,
 * each a whole-rupee amount (multiple of 100), that sum exactly to the
 * rounded total.
 *
 * Works with negative values and a mix of signs. If every input is already a
 * whole major unit and no separate total is given, the input is returned
 * unchanged.
 */
export function allocateRoundedMinor(partsMinor: number[], totalMinor?: number): number[] {
  if (partsMinor.length === 0) return [];

  const exactTotal = totalMinor ?? partsMinor.reduce((sum, p) => sum + p, 0);
  const targetRupees = roundHalfAwayFromZero(exactTotal / 100);

  // Floor each part toward negative infinity so the fractional remainder is
  // always in [0, 1); the residue is then a non-negative count of whole
  // rupees to hand back out (or, rarely, a negative count to claw back when
  // the rounded total lands below the sum of the floors).
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

/**
 * Convenience wrapper: `allocateRoundedMinor` followed by `formatMoney` on
 * each allocated value, so a component can render a reconciling breakdown in
 * one call.
 */
export function allocateAndFormat(
  partsMinor: number[],
  format: (minor: number) => string,
  totalMinor?: number
): string[] {
  return allocateRoundedMinor(partsMinor, totalMinor).map(format);
}
