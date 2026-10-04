import { hexToRgba } from '@/lib/color';

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * `color` at `alpha` as an rgba string, for a soft tinted fill. Handles #RGB, #RRGGBB and #RRGGBBAA (the
 * alpha digits are dropped in favour of `alpha`); anything that isn't hex comes back unchanged instead of
 * becoming an invalid colour.
 */
export function softTint(color: string, alpha: number): string {
  return HEX.test(color) ? hexToRgba(color, alpha) : color;
}
