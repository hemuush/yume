import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '@/constants/theme';

/** How thick the coloured strip along a StripCard's top edge is. */
const STRIP = 4;

/**
 * The white hero card of the screens opened from Plan (Budgets, Savings goals, Loans, Recurring): a soft lift
 * like Home's month card and a strip along its top edge in `tone`, which says what the card is about (or how
 * it's going). `style` carries the screen's margins and padding.
 */
export function StripCard({
  tone,
  lifted = true,
  style,
  children,
}: {
  tone: string;
  /** The first card on a screen sits lifted; a card in a list (a goal, a person) lies flat. */
  lifted?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  // The shadow is on an outer view: the inner one clips the strip to the corners, and a clipping view's
  // own shadow would be cut off on iOS.
  return (
    <View style={[styles.outer, lifted && styles.lifted, style, styles.noPadding]}>
      <View style={[styles.inner, style, styles.noMargin]}>
        <View style={[styles.strip, { backgroundColor: tone }]} />
        {children}
      </View>
    </View>
  );
}

/** The small dot before a StripCard's kicker, in the strip's deeper shade. */
export function KickerDot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  outer: { borderRadius: theme.radius.xl2, backgroundColor: theme.colors.surface },
  lifted: {
    shadowColor: theme.colors.link,
    shadowOpacity: 0.1,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  inner: {
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  noPadding: { padding: 0, paddingTop: 0, paddingBottom: 0, paddingVertical: 0, paddingHorizontal: 0 },
  noMargin: {
    margin: 0,
    marginTop: 0,
    marginBottom: 0,
    marginVertical: 0,
    marginHorizontal: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  strip: { position: 'absolute', top: 0, left: 0, right: 0, height: STRIP },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
