import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { getAccentColor, setAccentColor, getCachedAccentColor, getThemeId, setThemeId } from '@/db/settings';
import { THEMES, DEFAULT_THEME_ID, themeById } from './themes';
import { theme } from '@/constants/theme';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

// Picks black or white text readable on the user's accent: light accents (white, mint, sky) need dark
// text, dark ones (ink) need light text.
function contrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? theme.colors.ink : theme.colors.surface;
}

interface AccentContextValue {
  /** The active pack's id — drives which card the Theme picker highlights. */
  themeId: string;
  /** The active pack's primary; keeps the original name/shape so every `useAccent().accent` reader
   *  (buttons, active tab, Reports' moon phase, home widget, ...) works unchanged. */
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
    // Reads the last-picked pack. A pre-theme install has no `theme_id` row (null), so it keeps the stored
    // accent hex as-is, with the default pack's secondary, rather than snapping back to Yume's.
    Promise.all([getThemeId(), getAccentColor()])
      .then(([id, hex]) => {
        setAccentState(hex);
        setThemeIdState(id ?? DEFAULT_THEME_ID);
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((id: string) => {
    const pack = themeById(id);
    if (!pack) return;
    setThemeIdState(id);
    setAccentState(pack.primary);
    // A failed write only costs the choice on the next launch; the theme still applies this session.
    Promise.resolve(setThemeId(id)).catch(() => {});
    Promise.resolve(setAccentColor(pack.primary)).catch(() => {});
  }, []);

  // A pack this install hasn't selected (the pre-theme fallback above) gets the default pack's
  // `secondary`/`dot`.
  const activePack = themeById(themeId) ?? cachedInitial;
  const secondary = activePack.secondary;
  const dot = activePack.dot ?? activePack.secondary;

  const value = useMemo(
    () => ({ themeId, accent, secondary, dot, onAccent: contrastColor(accent), setTheme }),
    [themeId, accent, secondary, dot, setTheme]
  );

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextValue {
  return useContext(AccentContext);
}

export { THEMES };
