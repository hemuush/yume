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
 * colour blobs (the theme colour at the top right, the second colour at the left) and two white glows (a pale
 * circle behind the upper left, and one at the bottom) for depth behind the glass cards. Static: nothing here re-renders on scroll.
 */
export const HomeWallpaper = memo(function HomeWallpaper({
  accent,
  secondary,
  plain = false,
}: {
  accent: string;
  secondary: string;
  /** Home's own: the wash alone, without the two light blobs the other screens keep behind their glass. */
  plain?: boolean;
}) {
  const top = wallpaperTop(accent);
  const mid = shade(accent, 94);
  const blobA = shade(accent, 82);
  const blobB = shade(secondary, 86);
  return (
    <View pointerEvents="none" renderToHardwareTextureAndroid style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[top, mid, theme.colors.background]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      {!plain && (
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="wpA" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={blobA} stopOpacity={0.8} />
              <Stop offset="1" stopColor={blobA} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="wpB" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={blobB} stopOpacity={0.5} />
              <Stop offset="1" stopColor={blobB} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="wpC" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="30%" cy="38%" r="240" fill="url(#wpC)" />
          <Circle cx="95%" cy="0" r="240" fill="url(#wpA)" />
          <Circle cx="0%" cy="46%" r="190" fill="url(#wpB)" />
          <Circle cx="75%" cy="100%" r="300" fill="url(#wpC)" />
        </Svg>
      )}
    </View>
  );
});
