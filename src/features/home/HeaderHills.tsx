import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';

export const HILLS_HEIGHT = 26;

/**
 * The Home header's bottom edge (the Home A sign-off): a thin line of rolling
 * hills, with two little trees, in the theme pack's own colours — a small
 * touch of scenery that costs no height, in place of the old scalloped edge.
 * The nearest hill is the page's own cream, so the header rolls straight
 * into the page rather than ending in a band.
 */
export function HeaderHills({
  sky,
  primary,
  secondary,
  ground = theme.colors.background,
}: {
  sky: string;
  primary: string;
  secondary: string;
  /** The nearest hill; the page colour unless the strip sits inside a card. */
  ground?: string;
}) {
  const far = shade(secondary, 86, -8);
  const mid = shade(primary, 84, -6);
  const tree = shade(secondary, 72, -6);
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width="100%" height={HILLS_HEIGHT} viewBox={`0 0 360 ${HILLS_HEIGHT}`} preserveAspectRatio="none">
        <Rect x={0} y={0} width={360} height={HILLS_HEIGHT} fill={sky} />
        <Path d="M0 10 C50 0 90 3 130 11 C170 19 210 1 260 6 C300 10 330 16 360 9 V26 H0Z" fill={far} />
        <Path d="M0 16 C60 7 120 12 180 17 C240 22 300 10 360 14 V26 H0Z" fill={mid} />
        <Rect x={290.8} y={9} width={2.4} height={7} rx={1} fill="#B99A7A" />
        <Circle cx={292} cy={7} r={5.5} fill={tree} />
        <Rect x={306} y={11} width={2} height={6} rx={1} fill="#B99A7A" />
        <Circle cx={307} cy={9} r={4.5} fill={tree} />
        <Path d="M0 21 C80 16 160 19 230 22 C290 25 330 20 360 20 V26 H0Z" fill={ground} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: HILLS_HEIGHT, marginTop: -1 },
});
