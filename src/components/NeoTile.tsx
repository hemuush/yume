import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  backgroundColor?: string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

// Properties that must sit on the outer wrapper for flexbox to size the tile in its parent; everything
// else in `style` (padding, justifyContent, alignItems...) goes on the inner card to inset *content*.
const LAYOUT_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
] as const;

function splitStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const flat = StyleSheet.flatten(style) ?? {};
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    if ((LAYOUT_KEYS as readonly string[]).includes(key)) outer[key] = value;
    else inner[key] = value;
  }
  return [outer as ViewStyle, inner as ViewStyle];
}

/**
 * The app's one card shape: a soft hairline border and whitespace, no thick outline or offset shadow.
 * `style` is split: flex/width/margin go on the outer wrapper (sizing), padding/alignItems on the inner card.
 */
export function NeoTile({
  children,
  backgroundColor = theme.colors.surface,
  borderRadius = theme.radius.xl2,
  style,
}: Props) {
  const [outerStyle, innerStyle] = splitStyle(style);
  // A coloured identity card (stat tile, account, loan) separates from the page by its colour and needs no
  // border; only the plain default card gets the hairline.
  const isColored = backgroundColor !== theme.colors.surface;
  return (
    <View style={[styles.wrap, outerStyle]}>
      <View
        style={[styles.card, isColored && styles.cardColored, { backgroundColor, borderRadius }, innerStyle]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  // flex: 1 so the card fills its wrap in both axes (a plain block child only stretches on the cross
  // axis), else the wrap can be taller than the card when matched to a taller sibling (Home bento row).
  card: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
  cardColored: { borderWidth: 0 },
});
