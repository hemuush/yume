// Small colour-space helpers used to derive matching light/dark shades of a
// single hue (e.g. the user's chosen accent) instead of reaching for
// unrelated fixed colours — kept pure and dependency-free like every other
// src/lib module.

/** #RGB/#RRGGBB (with or without '#') to [h 0-360, s 0-100, l 0-100]. */
export function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s * 100, l * 100];
}

/** [h 0-360, s 0-100, l 0-100] to '#RRGGBB'. */
export function hslToHex(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  if (ss === 0) {
    const v = toHex(ll);
    return `#${v}${v}${v}`;
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const r = hue2rgb(p, q, hh + 1 / 3);
  const g = hue2rgb(p, q, hh);
  const b = hue2rgb(p, q, hh - 1 / 3);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * The same hue and (optionally adjusted) saturation as `hex`, at a new
 * lightness — a "lighter/darker version of this exact colour" instead of an
 * unrelated fixed swatch. `saturationDelta` nudges saturation up (positive)
 * or down (negative); deep/low-lightness shades usually read better a touch
 * more saturated so they don't go muddy.
 */
export function shade(hex: string, lightness: number, saturationDelta = 0): string {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h, s + saturationDelta, lightness);
}

/** #RGB/#RRGGBB to an 'rgba(r, g, b, alpha)' string at the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The Reports spend-heatmap's 5-step intensity ramp (index 0 is "no spend",
 * drawn as an outline instead), derived from the user's chosen accent so the
 * calendar reads as "this app's colour" whichever accent is picked. It rises
 * from a faint wash to the accent itself and stops there: the busiest day is
 * the full pastel accent, never a darkened, saturated version of it.
 */
export function spendHeatScale(accent: string): readonly [string, string, string, string, string] {
  return ['transparent', hexToRgba(accent, 0.2), hexToRgba(accent, 0.42), hexToRgba(accent, 0.7), accent];
}

/**
 * A stable index into a palette of length `modulo`, derived from `id` — for
 * picking a person/entity's own colour so it stays the same regardless of
 * where they land in a list (unlike `array[i % array.length]` keyed to
 * position, which reassigns everyone's colour the moment the list is
 * reordered or someone new is added ahead of them). A plain djb2-style
 * string hash — not cryptographic, just needs to spread ids evenly across
 * the palette.
 */
export function stableIndexFromId(id: string, modulo: number): number {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  return Math.abs(hash) % modulo;
}
