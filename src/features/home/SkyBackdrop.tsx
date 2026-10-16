import { StyleSheet } from 'react-native';
import ReanimatedAnimated, { useAnimatedStyle, useDerivedValue, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { shade, hexToRgba } from '@/lib/color';

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/** Header wash fades into a pinned solid bar during collapse. Render before header content. */
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
  const shift = useDerivedValue(() => Math.min(Math.max(0, distance.value), Math.max(0, scrollY.value)));
  const progress = useDerivedValue(() => (distance.value > 0 ? shift.value / distance.value : 0));

  const washStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return { opacity: 1 - clamp01(p * 1.4) };
  });
  // The header slides up by `shift`; the bar slides back down by the same amount, so it stays at the top.
  const barStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return { opacity: clamp01((p - 0.55) / 0.45), transform: [{ translateY: shift.value }] };
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
        >
          <LinearGradient colors={[barColor, hexToRgba(barColor, 0)]} style={styles.edge} />
        </ReanimatedAnimated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', top: '100%', left: 0, right: 0, height: 16 },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
