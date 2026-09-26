import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAccentColor, setAccentColor, getCachedAccentColor, getThemeId, setThemeId } from '@/db/settings';
import { THEMES, DEFAULT_THEME_ID, themeById } from './themes';
import { theme } from '@/constants/theme';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

// Picks black or white text so it stays readable on whatever accent color
// the user picks — a light accent (white, mint, sky) needs dark text; a dark
// one (ink) needs light text.
function contrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? theme.colors.ink : theme.colors.surface;
}

interface AccentContextValue {
  /** The active pack's id — drives which card the Theme picker highlights. */
  themeId: string;
  /** The active pack's primary — unchanged name/shape from before this was
   *  theme-aware, so every existing `useAccent().accent` reader (buttons,
   *  the active tab, Reports' moon phase, the home widget, …) keeps working
   *  with no changes of its own. */
  accent: string;
  /** The active pack's secondary — new. */
  secondary: string;
  /** Suu's dot colour — usually equal to `secondary`, except the default
   *  pack, which keeps Suu's original coral. */
  dot: string;
  onAccent: string;
  setTheme: (id: string) => void;
}

const cachedInitial = themeById(DEFAULT_THEME_ID)!;

const AccentContext = createContext<AccentContextValue>({
  themeId: DEFAULT_THEME_ID,
  accent: getCachedAccentColor(),
  secondary: cachedInitial.secondary,
  dot: cachedInitial.dot ?? cachedInitial.secondary,
  onAccent: contrastColor(getCachedAccentColor()),
  setTheme: () => {},
});

export function AccentProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);
  const [accent, setAccentState] = useState(getCachedAccentColor());

  useEffect(() => {
    // Reads whichever pack was last picked. A pre-theme install (or one
    // that only ever set a raw accent hex) has no `theme_id` row yet — that
    // read comes back `null`, so it falls back to the stored accent hex
    // as-is (never silently overwritten) with the default pack's secondary,
    // rather than snapping an existing custom-looking accent back to Yume's.
    Promise.all([getThemeId(), getAccentColor()])
      .then(([id, hex]) => {
        setAccentState(hex);
        setThemeIdState(id ?? DEFAULT_THEME_ID);
      })
      .catch(() => {});
  }, []);

  const setTheme = (id: string) => {
    const pack = themeById(id);
    if (!pack) return;
    setThemeIdState(id);
    setAccentState(pack.primary);
    void setThemeId(id);
    void setAccentColor(pack.primary);
  };

  // Anything reading `secondary`/`dot` for a pack this install hasn't
  // actually selected (the pre-theme fallback above) gets the default
  // pack's values — the same ones it would already be seeing today.
  const activePack = themeById(themeId) ?? cachedInitial;
  const secondary = activePack.secondary;
  const dot = activePack.dot ?? activePack.secondary;

  return (
    <AccentContext.Provider
      value={{ themeId, accent, secondary, dot, onAccent: contrastColor(accent), setTheme }}
    >
      {children}
    </AccentContext.Provider>
  );
}

export function useAccent(): AccentContextValue {
  return useContext(AccentContext);
}

export { THEMES };
