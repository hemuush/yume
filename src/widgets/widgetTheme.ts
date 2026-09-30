import { hexToRgba, shade } from '@/lib/color';

/**
 * Colour/font tokens for the home-screen widgets — a small, deliberate
 * subset of `@/constants/theme`, copied rather than imported.
 *
 * Widget components render in Android's own RemoteViews process, not React
 * Native's — `@/constants/theme` itself is plain data (no hooks, no native
 * calls) so importing it would technically work, but keeping widgets on
 * their own copy makes it obvious at a glance that nothing here can quietly
 * start depending on something RemoteViews can't render (a custom font
 * object, a StyleSheet.create() result, etc). Values below are the exact
 * hex the app already uses for each of these, kept in sync by hand.
 */
export const widgetColor = {
  ink: '#12130F',
  inkSoft: '#5B5748',
  textMuted: '#6C685B',
  cream: '#FFFDF6',
  surfaceAlt: '#F3ECE0',
  white: '#FFFFFF',
  borderSoft: '#E6DFC9',
  income: '#1C9A5B',
  incomeText: '#167747',
  expense: '#E23F55',
  expenseText: '#BD3547',
  // Home's month card: the ring's spent slice and its tile, and the moon-cream face.
  spentSoft: '#FFC9B3',
  idCoral: '#FFE3D6',
  idSage: '#E9F3DA',
  moonFace: '#FBF3DA',
  // Account hues, the same as Home's account cards (see accountHue in AccountChip).
  flatLime: '#E0F0A8',
  idGoldDeep: '#E0AC3F',
  idCoralDeep: '#F0876A',
} as const;

/**
 * The widget fonts, bundled through the config plugin's `fonts` array in
 * app.json (the file name minus its extension is the family name): Fredoka
 * for headings, Archivo for text, Space Mono for amounts — the app's own
 * three — plus Material Community Icons for category and account icons.
 */
export const WIDGET_FONT = {
  rounded: 'Fredoka_600SemiBold',
  roundedMedium: 'Fredoka_500Medium',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_600SemiBold',
  mono: 'SpaceMono_700Bold',
  icons: 'MaterialCommunityIcons',
} as const;

/** Home's calm card corner (theme.radius.xl2). */
export const WIDGET_RADIUS = 22;

/**
 * Builds an rgba colour string typed as the library's own `ColorProp` —
 * needed anywhere the alpha (or any channel) is computed rather than a
 * fixed literal, since a plain template-literal expression widens to
 * `string` and no longer matches `ColorProp`'s exact-shape type.
 */
export function widgetRgba(
  r: number,
  g: number,
  b: number,
  a: number
): `rgba(${number}, ${number}, ${number}, ${number})` {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Trusts a colour that came from the database (the user's own accent, or an
 * account/category colour) to already be a valid `#rrggbb` hex — every
 * writer of these values in the app (the accent picker, category/account
 * seeding) only ever stores that shape, so this is a type-level cast, not a
 * runtime check.
 */
export function asWidgetColor(hex: string): `#${string}` {
  return hex as `#${string}`;
}

/** A pale tint of a colour, for a tile or icon circle — the shade Home's account cards use. */
export function widgetTint(hex: string, lightness = 92): `#${string}` {
  return asWidgetColor(shade(hex, lightness));
}

/** A colour at partial opacity, the way Home's CategoryIcon tints its circle. */
export function widgetAlpha(hex: string, alpha: number): `rgba(${number}, ${number}, ${number}, ${number})` {
  return hexToRgba(hex, alpha) as `rgba(${number}, ${number}, ${number}, ${number})`;
}
