import { StyleSheet } from 'react-native';
import ReanimatedAnimated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { shade, hexToRgba } from '@/lib/color';
import { HILLS_HEIGHT_COMPACT } from './HeaderHills';

/** How far below a collapsed header's title row the cap takes to dissolve into the list: short, so rows don't ghost. */
const SKY_FADE = 10;

/** The sky's colours: deep at the top, paler by the middle, and the page's own cream where it ends. */
export function skyColors(accent: string) {
  return { top: shade(accent, 90, 4), mid: shade(accent, 94, 4), page: theme.colors.background };
}

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/**
 * The sky behind a header, drawn so the header has no edge of its own. Fully open, the sky fades from the theme's
 * colour at the top into the page cream at the bottom. While it collapses, a `cap` takes over: sky behind the
 * status bar, easing into solid page cream by the bottom of the title row, then a short fade to nothing, so
 * the list slides under a clean cream edge instead of showing through (ghosted text) or ending at a line. The
 * band lets go once the cap is in, so there is always sky behind the title row.
 *
 * Render it first inside the sliding header (it sits under the title row) and keep the band over it transparent.
 * `collapsedHeight` is how much of the page the collapsed title row covers; 0 until it is measured.
 */
export function SkyBackdrop({
  accent,
  scrollY,
  distance,
  collapsedHeight,
}: {
  accent: string;
  scrollY: SharedValue<number>;
  /** How far the header can collapse; 0 for a header that doesn't. */
  distance: SharedValue<number>;
  collapsedHeight: number;
}) {
  const { top, mid, page } = skyColors(accent);
  const total = collapsedHeight + SKY_FADE;

  const bandStyle = useAnimatedStyle(() => {
    const d = distance.value;
    const p = d > 0 ? clamp01(scrollY.value / d) : 0;
    return { opacity: 1 - clamp01(p * 2 - 1) };
  });
  // The header slides up by `shift`; the cap slides back down by the same amount, so it stays at the top.
  const capStyle = useAnimatedStyle(() => {
    const d = distance.value;
    const p = d > 0 ? clamp01(scrollY.value / d) : 0;
    const shift = d > 0 ? Math.min(d, Math.max(0, scrollY.value)) : 0;
    return { opacity: Math.min(1, p * 2), transform: [{ translateY: shift }] };
  });

  return (
    <>
      <ReanimatedAnimated.View pointerEvents="none" style={[styles.band, bandStyle]}>
        <LinearGradient colors={[top, mid, page]} locations={[0, 0.36, 1]} style={StyleSheet.absoluteFill} />
      </ReanimatedAnimated.View>
      {collapsedHeight > 4 && (
        <ReanimatedAnimated.View pointerEvents="none" style={[styles.cap, { height: total }, capStyle]}>
          <LinearGradient
            colors={[top, mid, page, hexToRgba(page, 0)]}
            locations={[0, (collapsedHeight * 0.45) / total, collapsedHeight / total, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ReanimatedAnimated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Everything above the hills strip (which overlaps the band by a pixel).
  band: { position: 'absolute', top: 0, left: 0, right: 0, bottom: HILLS_HEIGHT_COMPACT - 1 },
  cap: { position: 'absolute', top: 0, left: 0, right: 0 },
});
