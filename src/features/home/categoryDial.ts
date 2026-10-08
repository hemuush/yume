/**
 * Geometry for Home's category dial: bubbles along an arc that bulges to the right, the picked one stretched
 * into a pill. Pure worklet maths, so the dial can glide between picks on the UI thread.
 */
export const DIAL = {
  /** The dial's box. */
  width: 190,
  height: 248,
  /** The arc's centre (left of the box) and radius. */
  cx: -10,
  cy: 124,
  r: 130,
  /** Degrees along the arc taken by a bubble, the picked pill, and the gap between them. */
  bubble: 15,
  pill: 36,
  gap: 3.5,
  /** Bubble diameter, and the pill's thickness. */
  dot: 34,
  thick: 40,
} as const;

/**
 * Each item's [start, end] angle in degrees, centred on the arc's middle. `sel` may be fractional mid-glide:
 * an item within one step of it is part-way between a bubble and the pill, so the widths blend smoothly.
 */
export function dialSpans(count: number, sel: number): [number, number][] {
  'worklet';
  const widths: number[] = [];
  let total = DIAL.gap * Math.max(0, count - 1);
  for (let i = 0; i < count; i++) {
    const w = DIAL.bubble + (DIAL.pill - DIAL.bubble) * Math.max(0, 1 - Math.abs(i - sel));
    widths.push(w);
    total += w;
  }
  const out: [number, number][] = [];
  let a = -total / 2;
  for (let i = 0; i < count; i++) {
    out.push([a, a + widths[i]]);
    a += widths[i] + DIAL.gap;
  }
  return out;
}

/** The point on the arc at `deg`. */
export function dialPoint(deg: number): { x: number; y: number } {
  'worklet';
  const r = (deg * Math.PI) / 180;
  return { x: DIAL.cx + DIAL.r * Math.cos(r), y: DIAL.cy + DIAL.r * Math.sin(r) };
}

/** The picked pill's [start, end] angle: the picked items' spans, weighted by how picked each one is. */
export function dialPill(count: number, sel: number): [number, number] {
  'worklet';
  const spans = dialSpans(count, sel);
  let a0 = 0;
  let a1 = 0;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const w = Math.max(0, 1 - Math.abs(i - sel));
    a0 += spans[i][0] * w;
    a1 += spans[i][1] * w;
    sum += w;
  }
  if (sum === 0) return spans[0] ?? [0, 0];
  return [a0 / sum, a1 / sum];
}
