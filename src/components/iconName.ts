import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

/**
 * A MaterialCommunityIcons glyph name. Category and settings icons are
 * stored as plain strings (in the database, or in constant tables), so they
 * are cast to this where they're drawn; an unknown name draws a blank glyph.
 */
export type McIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
