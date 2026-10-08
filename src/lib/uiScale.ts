import { useWindowDimensions } from 'react-native';
import { MAX_FONT_SCALE } from '@/components/Text';

/**
 * How much the fixed-size parts of a screen (tab bar, buttons, card padding) follow the phone's font-size
 * setting. Text already follows it fully; without this, a phone set to a small font keeps full-size tiles
 * around shrunken text, and a large font squeezes text into tiles built for the default. Layout follows at
 * half the rate, so the default (100%) is exactly the designed size.
 */
export function uiScaleFor(fontScale: number): number {
  const f = Math.min(Math.max(fontScale, 0.8), MAX_FONT_SCALE);
  return 1 + (f - 1) * 0.5;
}

/** `uiScaleFor` for the phone's current font size. */
export function useUiScale(): number {
  return uiScaleFor(useWindowDimensions().fontScale);
}
