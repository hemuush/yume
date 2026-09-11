import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  backgroundColor?: string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

// Properties that must land on the outer wrapper for flexbox to size this
// tile correctly inside its parent (a flex row/column) — anything else in
// `style` (padding, justifyContent, alignItems...) belongs on the inner
// card instead, since it needs to inset *content*, not the tile's own slot.
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
  const outer: any = {};
  const inner: any = {};
  for (const [key, value] of Object.entries(flat)) {
    if ((LAYOUT_KEYS as readonly string[]).includes(key)) outer[key] = value;
    else inner[key] = value;
  }
  return [outer, inner];
}

/**
 * The app's one card shape: a soft hairline border and whitespace, not a
 * thick black outline plus an offset shadow — cards are meant to separate
 * from each other calmly, not compete for attention. (This used to render a
 * hard offset shadow for a louder "neobrutalist" pass; that read as too much
 * once it was applied everywhere at once, so the shadow is gone, but the
 * component and its call sites are unchanged.)
 *
 * `style` is split between the outer wrapper (flex/width/margin — needed on
 * the direct child of a flex row/column for sizing to work at all) and the
 * inner card (padding, alignItems, etc. — needed inside the visible
 * bordered box, not as invisible space around it).
 */
export function NeoTile({
  children,
  backgroundColor = theme.colors.surface,
  borderRadius = theme.radius.lg,
  style,
}: Props) {
  const [outerStyle, innerStyle] = splitStyle(style);
  // A colored identity card (a stat tile, an account, a loan card) carries
  // its own separation from the page via that color and needs no border on
  // top of it; only the plain white/default card gets the hairline —
  // matching real cards vs. color blocks rather than outlining everything.
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
  // flex: 1 so the card always fills its wrap's resolved size in both axes
  // (a plain block child only auto-stretches on the cross axis, not the
  // main one) — otherwise the wrap can end up taller than the visible card
  // when stretched to match a taller sibling (e.g. in the Home bento row).
  card: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
  cardColored: { borderWidth: 0 },
});
