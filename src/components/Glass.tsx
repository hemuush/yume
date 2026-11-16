import { View, ViewProps, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { themedStyles, themedValue } from '@/theme/themedStyles';

/**
 * The fill and edge of a control that sits on the page (a round header button, a period pill, a search field): white
 * on the paper with a hairline edge, no shadow. The name is from the earlier frosted-glass look; the colours are the
 * quiet look's, and they follow the colour mode.
 */
export const GLASS = themedValue(() => ({
  fill: theme.colors.surface,
  fillStrong: theme.colors.surface,
  edge: theme.colors.borderSoft,
  shadow: 'none',
}));

/**
 * A block on the paper: no fill and no rounded box, just a hairline above it. (It was a frosted card; the quiet look has
 * no cards, so `radius` and `tone` are kept only so callers need not change.)
 */
export function Glass({
  style,
  radius: _radius,
  tone: _tone,
  ...view
}: ViewProps & { radius?: number; tone?: 'soft' | 'strong' }) {
  return <View {...view} style={[styles.glass, style]} />;
}

const styles = themedStyles(() =>
  StyleSheet.create({
    glass: {
      backgroundColor: 'transparent',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
  })
);
