import { theme } from '@/constants/theme';

/** About how wide one letter of a 13 dp label is at normal text. */
const LETTER_W = 6.8;

/**
 * Whether the longest word in the labels is wider than a choice's share of the track, from the window width (a
 * screen's gutter and a sheet's padding come to about 48 dp) and the text scale. Two choices always fit.
 * shortcut: estimated, not measured on the track, so a switch inside a narrow card can still be a little tight;
 * measure the track with onLayout if one turns out to be.
 */
export function tooTight(options: { label: string }[], width: number, fontScale: number): boolean {
  if (options.length < 3) return false;
  const longest = Math.max(...options.flatMap((o) => o.label.split(' ').map((word) => word.length)));
  const scale = Math.min(theme.accessibility.maxFontScale, Math.max(1, fontScale));
  return longest * LETTER_W * scale + 6 > (width - 48) / options.length;
}
