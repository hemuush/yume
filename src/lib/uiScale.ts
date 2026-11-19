import { useWindowDimensions } from 'react-native';
import { MAX_FONT_SCALE } from '@/components/Text';
import { theme } from '@/constants/theme';

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

/** The floating dock and its clearance use the same dimensions. */
export function tabDockMetrics(width: number, fontScale: number) {
  const narrow = width < 360;
  const stacked = narrow || fontScale > 1.15;
  const height = Math.max(
    theme.accessibility.minTouchTarget + 2,
    Math.round(60 * uiScaleFor(Math.min(fontScale, 1)))
  );
  const labelHeight = Math.ceil(16 * Math.min(Math.max(fontScale, 0.8), MAX_FONT_SCALE));
  const bottomGap = 10;
  const dockHeight = stacked ? Math.max(height, 44 + 16 + 4 + labelHeight + 2) : height;
  return {
    stacked,
    height,
    labelHeight,
    bottomGap,
    side: narrow ? 10 : 16,
    clearance: dockHeight + bottomGap,
  };
}

export function useTabDockMetrics() {
  const { width, fontScale } = useWindowDimensions();
  return tabDockMetrics(width, fontScale);
}

/** Space for the dock plus a gap below the last scrollable row. */
export function useTabScrollPad(): number {
  return useTabDockMetrics().clearance + 24;
}
