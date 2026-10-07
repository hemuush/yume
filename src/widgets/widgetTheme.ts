import { hexToRgba, shade } from '@/lib/color';

/**
 * Colour/font tokens for widgets: a subset of `@/constants/theme` copied, not imported, so nothing can start
 * depending on what RemoteViews can't render (font objects, StyleSheet.create()). Hex values synced by hand.
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
  spentSoft: '#F6A88E',
  idCoral: '#FFE3D6',
  idSage: '#E9F3DA',
  moonFace: '#FBF3DA',
  // Account hues, the same as Home's account cards (see accountHue in lib/account).
  flatLime: '#E0F0A8',
  idGoldDeep: '#E0AC3F',
  idCoralDeep: '#F0876A',
} as const;

/**
 * Widget fonts, bundled via the config plugin's `fonts` array in app.json (file name minus extension is the
 * family): Fredoka headings, Archivo text, Space Mono amounts, plus Material Community Icons.
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
 * Trusts a database colour (accent, account/category colour) to already be a valid `#rrggbb` hex, as every
 * writer only stores that shape; a type-level cast, not a runtime check.
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
