// Yume's exclusive theme packs — see the design sign-off artifact for the
// full reasoning. Each pack is just a primary/secondary pair, both kept
// inside the app's own pastel lightness band (theme.ts documents this as
// ~74-83%) rather than a source palette's true, much darker/more saturated
// colours — Yume never puts a saturated dark colour in the UI itself; only
// `theme.colors.ink` plays that role, everywhere, already.
//
// Deliberately no "Custom" entry: a theme is a considered pair, not a free
// colour picker. `AccentContext` still persists a plain accent hex under
// the hood (for backward compatibility with the widget code and any
// install that picked a swatch before this feature existed), but the
// picker UI only ever offers the named packs below.
export interface ThemePack {
  id: string;
  name: string;
  /** Short "primary & secondary" description shown under the name in the picker. */
  sub: string;
  primary: string;
  secondary: string;
  /** Suu's dot colour. Defaults to `secondary` — only the default pack
   *  overrides this, so installing this feature doesn't itself change
   *  Suu's long-standing coral dot for anyone who hasn't picked a pack. */
  dot?: string;
}

export const THEMES: ThemePack[] = [
  { id: 'yume', name: 'Yume', sub: 'Sky & mint', primary: '#8FCBFF', secondary: '#8FE8C8', dot: '#F0876A' },
  // Demon Slayer, in Yume's own register: Tanjiro's ichimatsu (市松)
  // black-and-green check and Nezuko's asanoha (麻の葉) hemp-leaf pink,
  // both lifted into the app's pastel band rather than the show's true
  // forest-green-and-near-black.
  { id: 'corpsGreen', name: 'Corps Green', sub: 'Moss & sakura', primary: '#AEDABB', secondary: '#F6BFD3' },
  // Jujutsu Kaisen: Gojo's cobalt-indigo paired with Sukuna's peach — named
  // after Gojo's own "Hollow Purple", which fuses those same two colours
  // into one, the same way this pack pairs them as primary + secondary.
  {
    id: 'hollowViolet',
    name: 'Hollow Violet',
    sub: 'Indigo & peach',
    primary: '#A6B4F2',
    secondary: '#F0B79A',
  },
  // Breaking Bad: the crystal-blue product and the money-green that
  // consumes Walt — the show's own two recurring colours, lifted out of
  // their true toxic saturation into a pale aqua and a soft chartreuse.
  {
    id: 'blueCrystal',
    name: 'Blue Crystal',
    sub: 'Cyan & money-green',
    primary: '#96E6E3',
    secondary: '#E0E696',
  },
  // Game of Thrones: rather than one house's colours, the show's own
  // ice/fire duality — a glacier grey-blue against a dragon-fire ember.
  {
    id: 'winterEmber',
    name: 'Winter Ember',
    sub: 'Ice-grey & ember',
    primary: '#BEC8D4',
    secondary: '#F09E86',
  },
  // Stranger Things: the cold teal of the desaturated Upside Down against
  // the one saturated colour the show lets through — neon red (Christmas
  // lights, the arcade sign).
  {
    id: 'neonStatic',
    name: 'Neon Static',
    sub: 'Teal & neon pink',
    primary: '#8CCED6',
    secondary: '#F27E8C',
  },
];

export const DEFAULT_THEME_ID = THEMES[0].id;

export function themeById(id: string | null | undefined): ThemePack | undefined {
  return THEMES.find((t) => t.id === id);
}

export interface ActiveTheme {
  themeId: string;
  primary: string;
  secondary: string;
  dot: string;
}

/**
 * Resolves the full active pack from what's actually persisted — the one
 * piece of theme-resolution logic, shared by `AccentContext` (the in-app
 * React tree) and the home-screen widgets (a headless RemoteViews process
 * with no React context at all, see `src/widgets/data.ts`). Before this was
 * shared, the widgets had their own, incomplete copy: `getAccentColor()`
 * alone, which only ever carries the pack's `primary` — the Suu widget's
 * moon dot stayed hardcoded to the default pack's colour forever, the one
 * part of Suu that picking a theme never reached.
 */
export async function resolveActiveTheme(
  getThemeId: () => Promise<string | null>,
  getAccentColor: () => Promise<string>
): Promise<ActiveTheme> {
  const [id, accent] = await Promise.all([getThemeId(), getAccentColor()]);
  const pack = themeById(id ?? undefined);
  if (pack)
    return {
      themeId: pack.id,
      primary: pack.primary,
      secondary: pack.secondary,
      dot: pack.dot ?? pack.secondary,
    };
  // No stored `theme_id` (a pre-theme install, or one that only ever had a
  // raw accent hex) — keep that hex as primary rather than silently
  // overwriting it, same as `AccentContext` always has, and use the default
  // pack's secondary/dot since there's no real pack to read them from.
  const fallback = themeById(DEFAULT_THEME_ID)!;
  return {
    themeId: DEFAULT_THEME_ID,
    primary: accent,
    secondary: fallback.secondary,
    dot: fallback.dot ?? fallback.secondary,
  };
}
