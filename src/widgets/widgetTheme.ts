import { hexToRgba, shade } from '@/lib/color';

/**
 * Colour/font tokens for widgets: a subset of `@/constants/theme` copied, not imported, so nothing can start
 * depending on what RemoteViews can't render (font objects, StyleSheet.create()). Hex values synced by hand.
 */
export const widgetColor = {
  ink: '#12130F',
  inkSoft: '#5B5748',
  textMuted: '#6C685B',
  cream: '#FFFDF8',
  surfaceAlt: '#F3ECE0',
  white: '#FFFFFF',
  borderSoft: '#E8E1D1',
  income: '#1C9A5B',
  incomeText: '#167747',
  expense: '#E23F55',
  expenseText: '#BD3547',
  tray: '#F8F3EA',
  slice: { spent: '#F6A88E', saved: '#7FDDB9', due: '#F0BC4E', free: '#7DB9F2' },
  // Account hues, the same as Home's account cards (see accountHue in lib/account).
  flatLime: '#E0F0A8',
  idGoldDeep: '#E0AC3F',
  idCoralDeep: '#F0876A',
} as const;

/**
 * Widget fonts, bundled via the config plugin's `fonts` array in app.json (file name minus extension is the
 * family): Fredoka headings, Archivo text, Archivo amounts, plus Material Community Icons.
 */
export const WIDGET_FONT = {
  rounded: 'Fredoka_600SemiBold',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_600SemiBold',
  amount: 'Archivo_600SemiBold',
  icons: 'MaterialCommunityIcons',
} as const;

/** Home's calm card corner (theme.radius.xl2). */
export const WIDGET_RADIUS = 22;

/** Space for four 44dp category targets plus shell padding/border and three action rows. */
export const QUICK_ADD_LAYOUT = {
  minWidth: 208,
  minHeight: 184,
  padding: 12,
  actionHeight: 44,
  categoryHeight: 48,
} as const;

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

/** Same deep theme ink used by the app's buttons; safe in headless rendering. */
export function widgetInk(accent: string): `#${string}` {
  return asWidgetColor(shade(accent, 16, -45));
}
