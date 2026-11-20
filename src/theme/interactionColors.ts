import { shade } from '@/lib/color';
import { softTint } from '@/components/softTint';
import { theme } from '@/constants/theme';
import { getScheme } from './scheme';

/**
 * The ink of buttons, picked chips, switches and links: the action colour (near-black on the paper, the logo’s sky on the dark),
 * not a darkened accent. The parameter stays so callers read as before; there is one accent now and it does not tint
 * the ink.
 */
export function themeInk(_accent?: string): string {
  return theme.colors.action;
}

export function interactionColors(accent: string) {
  return { ink: themeInk(accent), tint: shade(accent, 95), edge: shade(accent, 78, -30) };
}

/**
 * Chosen tabs and chips have a readable foreground on both the pale wash and the dark blue fill.
 */
export function selectedFill(accent: string): string {
  return getScheme() === 'dark' ? theme.colors.home.selected : softTint(accent, 0.5);
}
