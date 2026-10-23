// Yume's theme packs: primary/secondary pairs inside the pastel lightness band (~74-83%, see theme.ts), never
// a source palette's darker colours. No "Custom" entry; `AccentContext` still persists a plain accent hex.
export interface ThemePack {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  /** Suu's dot colour. Defaults to `secondary`; only the default pack overrides it, keeping Suu's
   *  long-standing coral dot for anyone who hasn't picked a pack. */
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
  // Demon Slayer: Tanjiro's ichimatsu (市松) black-and-green check and Nezuko's asanoha (麻の葉) hemp-leaf
  // pink, lifted into the pastel band rather than the show's true forest green and near-black.
  {
    id: 'corpsGreen',
    name: 'Corps Green',
    primary: '#AEDABB',
    secondary: '#F6BFD3',
  },
  // Jujutsu Kaisen: Gojo's cobalt-indigo with Sukuna's peach, named for Gojo's "Hollow Purple", which
  // fuses those same two colours.
  {
    id: 'hollowViolet',
    name: 'Hollow Violet',
    primary: '#A6B4F2',
    secondary: '#F0B79A',
  },
  // Game of Thrones: rather than one house's colours, the show's own
  // ice/fire duality — a glacier grey-blue against a dragon-fire ember.
  {
    id: 'winterEmber',
    name: 'Winter Ember',
    primary: '#BEC8D4',
    secondary: '#F09E86',
  },
  // Your Name: kataware-doki, the twilight hour when the two meet — an
  // orchid sky fading into the last gold of sunset. A dream story, like Yume.
  {
    id: 'katawareDusk',
    name: 'Kataware Dusk',
    primary: '#E2A6D8',
    secondary: '#FDD9A0',
  },
  // A red signal glowing through fog over a dark tower: the glow's red lifted into the pastel band, with the
  // night sky's slate as the second colour. Transfers and picked chips take the primary, so it stays clear
  // of the expense red (#BD3547) in the ink and the minus sign rather than in hue alone.
  {
    id: 'crimsonNight',
    name: 'Crimson Night',
    primary: '#EE6B73',
    secondary: '#8EA3AE',
  },
];

export const DEFAULT_THEME_ID = THEMES[0].id;

export function themeById(id: string | null | undefined): ThemePack | undefined {
  return THEMES.find((t) => t.id === id);
}

interface ActiveTheme {
  themeId: string;
  primary: string;
  secondary: string;
  dot: string;
}

/**
 * Resolves the full active pack from what's persisted: the one piece of theme-resolution logic, shared by
 * `AccentContext` and the headless home-screen widgets (no React context, see `src/widgets/data.ts`).
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
  // No stored `theme_id` (pre-theme install or raw accent hex only): keep that hex as primary and use
  // the default pack's secondary/dot, since there's no real pack to read them from.
  const fallback = themeById(DEFAULT_THEME_ID)!;
  return {
    themeId: DEFAULT_THEME_ID,
    primary: accent,
    secondary: fallback.secondary,
    dot: fallback.dot ?? fallback.secondary,
  };
}
