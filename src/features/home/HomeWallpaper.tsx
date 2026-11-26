import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '@/constants/theme';

/** The page colour a header bar and the page share, so the bar has no seam against it. */
export function wallpaperTop(): string {
  return theme.colors.background;
}

/**
 * What sits behind a page that used to carry Home's coloured wallpaper: plain paper. The quiet look has no wash,
 * blobs or glows; the component remains so screens keep one place that says what is behind them.
 */
export const HomeWallpaper = memo(function HomeWallpaper() {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]}
    />
  );
});
