import type { HeroSlices } from '@/features/home/heroSlices';

const STROKE = 9;
/** The gap left between two slices along the widget ring. */
const GAP = 3.5;
// Bills still due sit between saved and free.
const LAYERS = ['spent', 'saved', 'due', 'free'] as const;

/**
 * Home's month ring as an SVG string for the This Month widget: income split into spent, savings and free
 * to use, on a moon-cream face. One static dashed circle per slice (widgets can't animate).
 */
export function ringSvg(
  slices: HeroSlices,
  colors: { spent: string; saved: string; due: string; free: string; track: string; face: string },
  size: number
): string {
  const c = size / 2;
  const r = c - STROKE / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const share = (k: (typeof LAYERS)[number]) => slices[k] ?? 0;
  const present = LAYERS.filter((k) => share(k) > 0).length;
  const arcs = LAYERS.map((k, i) => {
    const before = LAYERS.slice(0, i).reduce((sum, prev) => sum + share(prev) * circumference, 0);
    const len = share(k) > 0 ? Math.max(0, share(k) * circumference - (present > 1 ? GAP : 0)) : 0;
    return len > 0
      ? `<circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="none" stroke="${colors[k]}" stroke-width="${STROKE}" stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-before).toFixed(2)}"/>`
      : '';
  }).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="none" stroke="${colors.track}" stroke-width="${STROKE}"/>` +
    `<circle cx="${c}" cy="${c}" r="${(r - STROKE / 2 - 5).toFixed(2)}" fill="${colors.face}"/>` +
    `<g transform="rotate(-90 ${c} ${c})">${arcs}</g>` +
    `</svg>`
  );
}
