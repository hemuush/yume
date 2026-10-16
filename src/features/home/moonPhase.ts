/**
 * Geometry for Home's month moon: the ring around it shows where income went, the lit part inside shows how
 * much of it was kept (savings plus what is free), from a thin crescent, like Suu, up to a full moon.
 */

/** A slice of the ring, on a circle drawn with `pathLength={100}`: its dash length and where it starts. */
export interface RingArc {
  len: number;
  offset: number;
}

/** A hairline between neighbouring slices, in percent of the ring; slices under 0.6% are drawn whole. */
const RING_GAP = 1.2;

/** Where each slice starts and how long it is, in order, from the top clockwise. Shares are fractions of 1. */
export function ringArcs(shares: readonly number[]): RingArc[] {
  let start = 0;
  return shares.map((share) => {
    const pct = Math.max(0, share) * 100;
    const arc = { len: Math.max(0, pct > 0.6 ? pct - RING_GAP : pct), offset: -start };
    start += pct;
    return arc;
  });
}

/** Below this the moon is all dark; above its complement it is all lit. */
const NEW_MOON = 0.008;
const FULL_MOON = 0.992;

/**
 * The lit part of a moon of radius `r` centred on (`cx`, `cy`), as an SVG path; empty for a new moon. The lit
 * side is always the right one: a right half circle plus a terminator ellipse whose width is `|2k - 1| * r`,
 * bulging left for more than half lit (gibbous) and right for less (crescent).
 */
export function moonLitPath(kept: number, cx: number, cy: number, r: number): string {
  if (!(kept > NEW_MOON)) return '';
  const top = cy - r;
  if (kept >= FULL_MOON) return `M${cx} ${top} A${r} ${r} 0 1 1 ${cx - 0.01} ${top} Z`;
  const rx = r * Math.abs(2 * kept - 1);
  const sweep = kept > 0.5 ? 1 : 0;
  return `M${cx} ${top} A${r} ${r} 0 0 1 ${cx} ${cy + r} A${rx.toFixed(2)} ${r} 0 0 ${sweep} ${cx} ${top} Z`;
}
