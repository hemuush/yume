import { shade } from '@/lib/color';
import { softTint } from '@/components/softTint';

/** Shared interaction colours; category and financial status colours remain semantic. */
export function themeInk(accent: string): string {
  return shade(accent, 16, -45);
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
