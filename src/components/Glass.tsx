import { View, ViewProps, StyleSheet } from 'react-native';

/**
 * Frosted glass on Home's wallpaper: translucent white with a bright hairline edge and a soft drop. No real blur
 * (Android only blurs fast from API 31), so the wallpaper behind is kept soft enough that plain translucency
 * reads as frost. `tone="strong"` is the brighter glass used for a control sitting on a glass card.
 */
export const GLASS = {
  fill: 'rgba(255,255,255,0.55)',
  fillStrong: 'rgba(255,255,255,0.78)',
  edge: 'rgba(255,255,255,0.9)',
  shadow: '0px 8px 24px rgba(16,32,51,0.06)',
} as const;

export function Glass({
  radius = 24,
  tone = 'soft',
  style,
  ...rest
}: ViewProps & { radius?: number; tone?: 'soft' | 'strong' }) {
  return (
    <View
      {...rest}
      style={[
        styles.glass,
        { borderRadius: radius, backgroundColor: tone === 'strong' ? GLASS.fillStrong : GLASS.fill },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glass: { borderWidth: 1, borderColor: GLASS.edge, boxShadow: GLASS.shadow },
});

/** A screen card (`screenStyles.card`) turned to glass: put it after the card style. */
export const GLASS_CARD = StyleSheet.create({
  card: {
    backgroundColor: GLASS.fill,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: GLASS.edge,
    boxShadow: GLASS.shadow,
  },
}).card;
