/**
 * The three non-overlapping regions of Home's moon (see HeroMoon), as SVG
 * paths on a disc of radius `r` centred at (cx, cy):
 *
 *   spent  — from the left edge to the "kept" terminator
 *   saved  — between the kept terminator and the "free" terminator
 *   free   — from the free terminator to the right edge
 *
 * A terminator is the elliptical boundary of the area-true lune Reports'
 * MoonPhase draws (`lunePath`): the region to its right covers exactly `k`
 * of the disc's area. So with keptK = saved + free and freeK = free, each
 * region's area is its own share of income.
 *
 * They're drawn as separate regions rather than stacked lunes on a full
 * disc: stacked, fading the top two let the disc underneath show through
 * them, so "Spent" could never actually stand out.
 *
 * Worklets, so the moon can animate its phase on the UI thread.
 */

interface Disc {
  cx: number;
  cy: number;
  r: number;
}

function clamp01(k: number): number {
  'worklet';
  return Math.max(0, Math.min(1, k));
}

/**
 * An arc along the terminator for `k`, from the top of the disc to the
 * bottom (`down`) or back up. Its horizontal radius is r·|1 − 2k|: it bulges
 * right for k < ½ (a crescent's inner edge), left for k > ½, and is a
 * straight line at exactly ½.
 */
function terminatorArc(d: Disc, k: number, down: boolean): string {
  'worklet';
  const c = clamp01(k);
  const a = d.r * Math.abs(1 - 2 * c);
  const bulgesRight = c < 0.5;
  // SVG sweep 1 = clockwise on screen: top→right→bottom, or bottom→left→top.
  const sweep = down === bulgesRight ? 1 : 0;
  const endY = down ? d.cy + d.r : d.cy - d.r;
  return `A ${a} ${d.r} 0 0 ${sweep} ${d.cx} ${endY}`;
}

export function spentRegion(d: Disc, keptK: number): string {
  'worklet';
  // Down the kept terminator, then back up the left half of the rim.
  return `M ${d.cx} ${d.cy - d.r} ${terminatorArc(d, keptK, true)} A ${d.r} ${d.r} 0 0 1 ${d.cx} ${d.cy - d.r} Z`;
}

export function savedRegion(d: Disc, keptK: number, freeK: number): string {
  'worklet';
  // Down the free terminator, back up the kept terminator.
  return `M ${d.cx} ${d.cy - d.r} ${terminatorArc(d, freeK, true)} ${terminatorArc(d, keptK, false)} Z`;
}

export function freeRegion(d: Disc, freeK: number): string {
  'worklet';
  // Down the right half of the rim, back up the free terminator.
  return `M ${d.cx} ${d.cy - d.r} A ${d.r} ${d.r} 0 0 1 ${d.cx} ${d.cy + d.r} ${terminatorArc(d, freeK, false)} Z`;
}
