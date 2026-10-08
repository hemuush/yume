import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';

/** The wallpaper's top colour: also the collapsed header bar's, so the bar has no seam against it. */
export function wallpaperTop(accent: string): string {
  return shade(accent, 88);
}

/**
 * Home's wallpaper: a soft wash of the theme colour at the top fading into the page colour, with two blurred
 * light blobs (radial gradients) for depth behind the glass cards. Static: nothing here re-renders on scroll.
 */
export const HomeWallpaper = memo(function HomeWallpaper({
  accent,
  secondary,
}: {
  accent: string;
  secondary: string;
}) {
  const top = wallpaperTop(accent);
  const mid = shade(accent, 94);
  const blobA = shade(accent, 80);
  const blobB = shade(secondary, 86);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[top, mid, theme.colors.background]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="wpA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={blobA} stopOpacity={0.75} />
            <Stop offset="1" stopColor={blobA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="wpB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={blobB} stopOpacity={0.6} />
            <Stop offset="1" stopColor={blobB} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="92%" cy="40" r="190" fill="url(#wpA)" />
        <Circle cx="0%" cy="460" r="170" fill="url(#wpB)" />
      </Svg>
    </View>
  );
});
