import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { getAccentColor, getCachedAccentColor, getThemeId, setThemeSelection } from '@/db/settings';
import { THEMES, DEFAULT_THEME_ID, themeById } from './themes';
import { theme } from '@/constants/theme';
import { onSettingsRestored } from '@/lib/dataEvents';

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
  themeSaveError: { message: string; attempt: number } | null;
  /** Waits for choices already queued, so background widget reads see the final persisted accent. */
  waitForThemePersistence: () => Promise<void>;
}

const cachedInitial = themeById(DEFAULT_THEME_ID)!;

const AccentContext = createContext<AccentContextValue>({
  themeId: DEFAULT_THEME_ID,
  accent: getCachedAccentColor(),
  secondary: cachedInitial.secondary,
  dot: cachedInitial.dot ?? cachedInitial.secondary,
  onAccent: contrastColor(getCachedAccentColor()),
  setTheme: () => {},
  themeSaveError: null,
  waitForThemePersistence: async () => {},
});

export function AccentProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);
  const [accent, setAccentState] = useState(getCachedAccentColor());
  const [themeSaveError, setThemeSaveError] = useState<AccentContextValue['themeSaveError']>(null);
  const committed = useRef({ id: DEFAULT_THEME_ID, accent: getCachedAccentColor() });
  const writes = useRef<Promise<void>>(Promise.resolve());
  const restoreEpoch = useRef(0);
  const generation = useRef(0);

  useEffect(() => {
    // Reads the last-picked pack. A pre-theme install has no `theme_id` row (null), so it keeps the stored
    // accent hex as-is, with the default pack's secondary, rather than snapping back to Yume's.
    const read = () => {
      const call = ++generation.current;
      return Promise.all([getThemeId(), getAccentColor()])
        .then(([id, hex]) => {
          if (call !== generation.current) return;
          setAccentState(hex);
          setThemeIdState(id ?? DEFAULT_THEME_ID);
          committed.current = { id: id ?? DEFAULT_THEME_ID, accent: hex };
          setThemeSaveError(null);
        })
        .catch(() => {});
    };
    void read();
    // A restore brings back the backup's theme.
    const unsubscribe = onSettingsRestored(() => {
      restoreEpoch.current += 1;
      void read();
    });
    return () => {
      generation.current += 1;
      unsubscribe();
    };
  }, []);

  const setTheme = useCallback((id: string) => {
    const pack = themeById(id);
    if (!pack) return;
    const call = ++generation.current;
    const epoch = restoreEpoch.current;
    setThemeIdState(id);
    setAccentState(pack.primary);
    setThemeSaveError(null);
    writes.current = writes.current.then(async () => {
      // Superseded or restored choices that haven't started no longer need a disk write.
      if (call !== generation.current) return;
      try {
        await setThemeSelection(id, pack.primary);
        if (epoch === restoreEpoch.current) committed.current = { id, accent: pack.primary };
      } catch (error) {
        // Local diagnostics match ErrorBoundary's offline reporting policy; no financial values are involved.
        console.error('Theme preference could not be saved:', error);
        if (call !== generation.current) return;
        setThemeIdState(committed.current.id);
        setAccentState(committed.current.accent);
        setThemeSaveError({ message: 'Couldn’t save this theme. Choose it again to retry.', attempt: call });
      }
    });
  }, []);

  // A pack this install hasn't selected (the pre-theme fallback above) gets the default pack's
  // `secondary`/`dot`.
  const activePack = themeById(themeId) ?? cachedInitial;
  const secondary = activePack.secondary;
  const dot = activePack.dot ?? activePack.secondary;
  const waitForThemePersistence = useCallback(() => writes.current, []);

  const value = useMemo(
    () => ({
      themeId,
      accent,
      secondary,
      dot,
      onAccent: contrastColor(accent),
      setTheme,
      themeSaveError,
      waitForThemePersistence,
    }),
    [themeId, accent, secondary, dot, setTheme, themeSaveError, waitForThemePersistence]
  );

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextValue {
  return useContext(AccentContext);
}

export { THEMES };
