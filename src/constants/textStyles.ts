import { TextStyle } from 'react-native';
import { theme } from './theme';

/**
 * The app's shared text roles, so a heading or label looks the same on every screen. Spread one into a
 * style and add only placement (margins, alignment, a colour where it carries meaning).
 */

/** A section heading above a card or list: Home's "Recent activity", Categories' groups. */
export const SECTION_TITLE: TextStyle = {
  fontFamily: theme.font.roundedBold,
  fontSize: 17,
  color: theme.colors.textPrimary,
};

/** The gap above a section heading, and below it before its card. */
export const SECTION_GAP = { top: 26, bottom: 10 } as const;

/**
 * A small uppercase label: a figure's caption ("SPENT", "YOU OWE"), a
 * divider inside a list ("PAUSED", "CLOSED"), a group of settings rows.
 */
export const EYEBROW: TextStyle = {
  fontFamily: theme.font.bodyBold,
  fontSize: 11,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: theme.colors.textMuted,
};

/** A form field's label, above its input (FormInput, DateField, pickers). */
export const FIELD_LABEL: TextStyle = {
  fontSize: 10.5,
  fontFamily: theme.font.roundedMedium,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: theme.colors.textMuted,
};
