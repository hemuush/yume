import { StyleSheet } from 'react-native';
import ReanimatedAnimated, { useAnimatedStyle, useDerivedValue, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { hexToRgba } from '@/lib/color';
import { themedStyles } from '@/theme/themedStyles';

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/** The pinned solid bar a collapsing header leaves behind. The page itself is plain paper, with no wash. */
export function SkyBackdrop({
  scrollY,
  distance,
  collapsedHeight,
  barColor = theme.colors.background,
  fadeEdge = true,
}: {
  scrollY: SharedValue<number>;
  /** How far the header can collapse; 0 for a header that doesn't. */
  distance: SharedValue<number>;
  collapsedHeight: number;
  /** The collapsed bar's colour. */
  barColor?: string;
  fadeEdge?: boolean;
}) {
  const shift = useDerivedValue(() => Math.min(Math.max(0, distance.value), Math.max(0, scrollY.value)));
  const progress = useDerivedValue(() => (distance.value > 0 ? shift.value / distance.value : 0));

  // The header slides up by `shift`; the bar slides back down by the same amount, so it stays at the top.
  const barStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return { opacity: clamp01((p - 0.55) / 0.45), transform: [{ translateY: shift.value }] };
  });

  return (
    <>
      {collapsedHeight > 4 && (
        <ReanimatedAnimated.View
          pointerEvents="none"
          style={[styles.bar, { height: collapsedHeight, backgroundColor: barColor }, barStyle]}
        >
          {fadeEdge && <LinearGradient colors={[barColor, hexToRgba(barColor, 0)]} style={styles.edge} />}
        </ReanimatedAnimated.View>
      )}
    </>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    edge: { position: 'absolute', top: '100%', left: 0, right: 0, height: 16 },
    bar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
  })
);
