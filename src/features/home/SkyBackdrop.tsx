import { StyleSheet } from 'react-native';
import ReanimatedAnimated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { shade, hexToRgba } from '@/lib/color';

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/**
 * What sits behind a header, the "quiet bar": open, the page colour with only a faint wash of the theme
 * behind the status bar, fading to nothing before the header's bottom, so the header has no edge. As it
 * collapses the wash fades and a solid page-colour `bar` comes in over the status bar and the title row
 * with a hairline under it, so rows slide under a clean edge (nothing shows through it).
 *
 * Render it first inside the sliding header (it sits under the title row). `collapsedHeight` is how much of
 * the page the collapsed title row covers; 0 until it is measured.
 */
export function SkyBackdrop({
  accent,
  scrollY,
  distance,
  collapsedHeight,
  barColor = theme.colors.background,
  wash: showWash = true,
}: {
  accent: string;
  scrollY: SharedValue<number>;
  /** How far the header can collapse; 0 for a header that doesn't. */
  distance: SharedValue<number>;
  collapsedHeight: number;
  /** The collapsed bar's colour: Home matches its wallpaper's top. */
  barColor?: string;
  /** Off where the page already has its own wallpaper behind the header (Home). */
  wash?: boolean;
}) {
  const wash = shade(accent, 90, 4);

  const washStyle = useAnimatedStyle(() => {
    const d = distance.value;
    const p = d > 0 ? clamp01(scrollY.value / d) : 0;
    return { opacity: 1 - clamp01(p * 1.4) };
  });
  // The header slides up by `shift`; the bar slides back down by the same amount, so it stays at the top.
  const barStyle = useAnimatedStyle(() => {
    const d = distance.value;
    const p = d > 0 ? clamp01(scrollY.value / d) : 0;
    const shift = d > 0 ? Math.min(d, Math.max(0, scrollY.value)) : 0;
    return { opacity: clamp01((p - 0.55) / 0.45), transform: [{ translateY: shift }] };
  });

  return (
    <>
      {showWash && (
        <ReanimatedAnimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, washStyle]}>
          <LinearGradient
            colors={[hexToRgba(wash, 0.7), hexToRgba(wash, 0)]}
            style={StyleSheet.absoluteFill}
          />
        </ReanimatedAnimated.View>
      )}
      {collapsedHeight > 4 && (
        <ReanimatedAnimated.View
          pointerEvents="none"
          style={[styles.bar, { height: collapsedHeight, backgroundColor: barColor }, barStyle]}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSoft,
  },
});
