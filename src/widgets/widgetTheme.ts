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
  textMuted: '#948E7C',
  cream: '#FFFDF6',
  borderSoft: '#E6DFC9',
  income: '#1C9A5B',
  expense: '#E23F55',
  mint: '#8FE8C8', // theme.colors.secondary — "kept" share of the spend bar
  coralDeep: '#F0876A', // theme.colors.idCoralDeep — "spent" share, and the credit/savings account badge
  sky: '#8FCBFF', // theme.colors.primary — Suu's moon highlight (was sage, ring-mark rebrand)
} as const;

/**
 * A translucent version of the cream surface — the closest RemoteViews gets
 * to the "frosted glass" look from the design pass. Android widgets can't
 * apply a real backdrop blur (no RenderEffect support in RemoteViews), so
 * this is honestly just a see-through fill, not a blurred one; it still
 * reads as "sitting on the wallpaper" rather than a solid card pasted over
 * it, which was the actual goal.
 */
export const WIDGET_GLASS_BG = 'rgba(255, 253, 246, 0.93)' as const;

/**
 * Bundled via the config plugin's `fonts` array (app.json) — filename minus
 * extension becomes the family name. Reserved for widget hero numbers; the
 * one in-app exception is LockScreen's clock (loaded separately there via
 * `useFonts` in app/_layout.tsx, as `theme.font.dotMatrix`), since that
 * screen is closer in spirit to a widget's glance than a normal screen.
 */
export const DOT_FONT = 'DotGothic16';

export const WIDGET_RADIUS = 24;

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
