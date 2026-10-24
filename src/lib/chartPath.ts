/**
 * Small pure helpers for drawing charts: a smooth curve through points and round guide values to read a scale
 * by. Kept out of the components so they can be tested without rendering.
 */

/** A smooth curve through the points that never overshoots between them (monotone cubic). */
export function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  const slope = pts.slice(1).map((p, i) => (p.y - pts[i].y) / (p.x - pts[i].x));
  const m = pts.map((_, i) =>
    i === 0
      ? slope[0]
      : i === n - 1
        ? slope[n - 2]
        : slope[i - 1] * slope[i] <= 0
          ? 0
          : (slope[i - 1] + slope[i]) / 2
  );
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x;
    d += ` C${(pts[i].x + h / 3).toFixed(1)},${(pts[i].y + (m[i] * h) / 3).toFixed(1)} ${(pts[i + 1].x - h / 3).toFixed(1)},${(pts[i + 1].y - (m[i + 1] * h) / 3).toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

/** Round guide values (…₹20k, ₹40k) between lo and hi, minor units; zero is included whenever it is in range. */
export function guideValues(lo: number, hi: number): number[] {
  const span = (hi - lo) / 100;
  if (span <= 0) return [0];
  const raw = span / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow * 100;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v));
  return out;
}
