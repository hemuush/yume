import { shade } from '@/lib/color';

/**
 * Home's deep ink: a dark, muted shade of the theme colour (navy for sky, plum for rose) for the one filled
 * button, the active tab and the dial's pill. Softer than black on the frosted wallpaper.
 */
export function homeInk(accent: string): string {
  return shade(accent, 16, -45);
}
