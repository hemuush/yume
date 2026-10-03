import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

/**
 * A MaterialCommunityIcons glyph name. Icons are stored as plain strings (DB or constant tables), so they're
 * cast to this where drawn; an unknown name draws a blank glyph.
 */
export type McIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
