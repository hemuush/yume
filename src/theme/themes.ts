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
  primary: string;
  secondary: string;
  /** Suu's dot colour. Defaults to `secondary` — only the default pack
   *  overrides this, so installing this feature doesn't itself change
   *  Suu's long-standing coral dot for anyone who hasn't picked a pack. */
  dot?: string;
}

export const THEMES: ThemePack[] = [
  {
    id: 'yume',
    name: 'Yume',
    primary: '#8FCBFF',
    secondary: '#8FE8C8',
    dot: '#F0876A',
  },
  // Demon Slayer, in Yume's own register: Tanjiro's ichimatsu (市松)
  // black-and-green check and Nezuko's asanoha (麻の葉) hemp-leaf pink,
  // both lifted into the app's pastel band rather than the show's true
  // forest-green-and-near-black.
  {
    id: 'corpsGreen',
    name: 'Corps Green',
    primary: '#AEDABB',
    secondary: '#F6BFD3',
  },
  // Jujutsu Kaisen: Gojo's cobalt-indigo paired with Sukuna's peach — named
  // after Gojo's own "Hollow Purple", which fuses those same two colours
  // into one, the same way this pack pairs them as primary + secondary.
  {
    id: 'hollowViolet',
    name: 'Hollow Violet',
    primary: '#A6B4F2',
    secondary: '#F0B79A',
  },
  // Breaking Bad: the crystal-blue product and the money-green that
  // consumes Walt — the show's own two recurring colours, lifted out of
  // their true toxic saturation into a pale aqua and a soft chartreuse.
  {
    id: 'blueCrystal',
    name: 'Blue Crystal',
    primary: '#96E6E3',
    secondary: '#E0E696',
  },
  // Game of Thrones: rather than one house's colours, the show's own
  // ice/fire duality — a glacier grey-blue against a dragon-fire ember.
  {
    id: 'winterEmber',
    name: 'Winter Ember',
    primary: '#BEC8D4',
    secondary: '#F09E86',
  },
  // Stranger Things: the cold teal of the desaturated Upside Down against
  // the one saturated colour the show lets through — neon red (Christmas
  // lights, the arcade sign).
  {
    id: 'neonStatic',
    name: 'Neon Static',
    primary: '#8CCED6',
    secondary: '#F27E8C',
  },
  // Attack on Titan: the Survey Corps' olive cloak and the slate blue of
  // the Wings of Freedom on its back.
  {
    id: 'scoutCloak',
    name: 'Scout Cloak',
    primary: '#D2CE9C',
    secondary: '#9AA9C9',
  },
  // Your Name: kataware-doki, the twilight hour when the two meet — an
  // orchid sky fading into the last gold of sunset. A dream story, like Yume.
  {
    id: 'katawareDusk',
    name: 'Kataware Dusk',
    primary: '#E2A6D8',
    secondary: '#FDD9A0',
  },
  // Dark: Jonas's yellow raincoat against the wet grey-green of Winden's
  // forest, where the cave is.
  {
    id: 'sicMundus',
    name: 'Sic Mundus',
    primary: '#F4D67A',
    secondary: '#9DB3A6',
  },
  // Harry Potter: Gryffindor's scarlet softened to a wine, and the worn gold
  // of the house crest and the Great Hall's candlelight.
  {
    id: 'scarletCrest',
    name: 'Scarlet Crest',
    primary: '#C78A9E',
    secondary: '#CFAE78',
  },
  // The Marvel Cinematic Universe: two of the six stones — the Time Stone's
  // green in the Eye of Agamotto, and the Soul Stone's orange from Vormir.
  {
    id: 'infinityGlow',
    name: 'Infinity Glow',
    primary: '#9DDC8E',
    secondary: '#F7A96F',
  },
  // Black Panther: the violet glow of vibranium and the heart-shaped herb,
  // beside the Dora Milaje's red, softened to a rose.
  {
    id: 'vibranium',
    name: 'Vibranium',
    primary: '#BCA2F2',
    secondary: '#E27FA6',
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
