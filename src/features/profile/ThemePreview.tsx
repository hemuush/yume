import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { GLASS } from '@/components/Glass';
import { wallpaperTop } from '@/features/home/HomeWallpaper';
import type { ThemePack } from '@/theme/themes';

/**
 * A theme pack drawn as a mini Home in its own colours: the wallpaper (its wash and two soft blobs), glass
 * cards on it and the tab bar. `detailed` is the tall phone at the top of the Theme page, with Suu's dot on
 * the first card and the active tab in ink. Used by the Theme page's cards and its live preview.
 */
export function ThemePreview({
  pack,
  height,
  detailed = false,
}: {
  pack: ThemePack;
  height: number;
  detailed?: boolean;
}) {
  const blobA = shade(pack.primary, 80);
  const blobB = shade(pack.secondary, 86);
  // Gradient ids are global to the page, so each preview needs its own.
  const id = `${pack.id}${detailed ? 'D' : ''}`;
  const pad = detailed ? 8 : 7;
  return (
    <View style={[styles.wrap, { height }]} importantForAccessibility="no-hide-descendants">
      <LinearGradient
        colors={[wallpaperTop(pack.primary), shade(pack.primary, 94), theme.colors.background]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`tpA${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={blobA} stopOpacity={0.9} />
            <Stop offset="1" stopColor={blobA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`tpB${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={blobB} stopOpacity={0.85} />
            <Stop offset="1" stopColor={blobB} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="90%" cy="10%" r={height * 0.7} fill={`url(#tpA${id})`} />
        <Circle cx="5%" cy="85%" r={height * 0.6} fill={`url(#tpB${id})`} />
      </Svg>
      {detailed ? (
        <>
          <View style={[styles.glass, { top: 26, left: pad, right: pad, height: 54 }]}>
            <View style={[styles.dot, { backgroundColor: pack.dot ?? pack.secondary }]} />
          </View>
          <View style={[styles.glass, { top: 88, left: pad, width: '42%', height: 34 }]} />
          <View style={[styles.glass, { top: 88, right: pad, width: '42%', height: 34 }]} />
          <View style={[styles.glass, { top: 130, left: pad, right: pad, height: 22 }]} />
          <View style={[styles.bar, { left: pad, right: pad, bottom: pad }]}>
            <View style={styles.barTab} />
          </View>
        </>
      ) : (
        <>
          <View style={[styles.glass, { top: 10, left: pad, right: pad * 3, height: 22 }]} />
          <View style={[styles.glass, { bottom: pad, left: pad, right: pad * 3, height: 16 }]} />
        </>
      )}
    </View>
  );
}

/** A 56 by 38 swatch of a pack: its wash with a blob of each colour. Used where a full preview is too tall. */
export function ThemeThumb({ pack }: { pack: ThemePack }) {
  return (
    <View style={thumb.wrap} importantForAccessibility="no-hide-descendants">
      <LinearGradient
        colors={[wallpaperTop(pack.primary), shade(pack.primary, 96, 2)]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[thumb.hill, { left: -6, backgroundColor: pack.primary }]} />
      <View style={[thumb.hill, { left: 22, backgroundColor: pack.secondary }]} />
    </View>
  );
}

const thumb = StyleSheet.create({
  wrap: {
    width: 56,
    height: 38,
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  hill: { position: 'absolute', bottom: -6, width: 36, height: 22, borderRadius: 18 },
});

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  glass: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fill,
  },
  dot: { position: 'absolute', top: 8, left: 8, width: 10, height: 10, borderRadius: 5 },
  bar: {
    position: 'absolute',
    height: 20,
    borderRadius: 10,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  barTab: {
    position: 'absolute',
    left: 3,
    top: 2,
    width: 30,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.ink,
  },
});
