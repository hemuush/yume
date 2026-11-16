import { shade } from '@/lib/color';
import { softTint } from '@/components/softTint';
import { theme } from '@/constants/theme';

/**
 * The ink of buttons, picked chips, switches and links: the page's own ink (near-black on the paper, cream on the dark),
 * not a darkened accent. The parameter stays so callers read as before; there is one accent now and it does not tint
 * the ink.
 */
export function themeInk(_accent?: string): string {
  return theme.colors.ink;
}

export function interactionColors(accent: string) {
  return { ink: themeInk(accent), tint: shade(accent, 95), edge: shade(accent, 78, -30) };
}

/**
 * The fill behind a chosen tab, pill or chip: the user's theme colour at half strength, so the choice is clear
 * without a solid block of colour. Text on it stays the normal dark ink.
 */
export function selectedFill(accent: string): string {
  return softTint(accent, 0.5);
}
