import { shade } from '@/lib/color';

/** Shared interaction colours; category and financial status colours remain semantic. */
export function themeInk(accent: string): string {
  return shade(accent, 16, -45);
}

export function interactionColors(accent: string) {
  return { ink: themeInk(accent), tint: shade(accent, 95), edge: shade(accent, 78, -30) };
}
