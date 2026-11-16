import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { getAppearance, getCachedAppearance, setAppearance } from '@/db/settings';
import { onSettingsRestored } from '@/lib/dataEvents';
import { applyScheme, resolveScheme, type AppearancePreference, type Scheme } from './scheme';

interface AppearanceValue {
  /** What the person chose: follow the phone, or always light, or always dark. */
  preference: AppearancePreference;
  /** The mode the app is drawn in right now. */
  scheme: Scheme;
  setPreference: (next: AppearancePreference) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceValue>({
  preference: 'system',
  scheme: 'light',
  setPreference: async () => {},
});

const fromPhone = (name: string | null | undefined): Scheme => (name === 'dark' ? 'dark' : 'light');

/**
 * Decides the colour mode (the person's choice, or the phone's own setting) and applies it for the whole app.
 * The first mode is applied while the first screen is being made, so no screen is ever drawn in the wrong one
 * and then corrected; later changes (the phone switching to dark at night, or a pick in Settings) are applied
 * before the next paint. See `scheme.ts`, `themedStyles.ts` and `SchemeBoundary`.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<AppearancePreference>(getCachedAppearance());
  const phone = fromPhone(useColorScheme());
  const scheme = resolveScheme(preference, phone);
  // The very first render: apply before any child reads a colour (nobody is listening yet, so nothing redraws).
  useState(() => applyScheme(scheme));

  // Every later change. A layout effect, so listeners redraw before the screen is painted.
  useLayoutEffect(() => {
    applyScheme(scheme);
  }, [scheme]);

  useEffect(() => {
    let cancelled = false;
    const read = () =>
      getAppearance()
        .then((next) => {
          if (!cancelled) setPreferenceState(next);
        })
        .catch(() => {});
    void read();
    // A restored backup brings its own preference.
    const unsubscribe = onSettingsRestored(() => void read());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setPreference = useCallback(async (next: AppearancePreference) => {
    setPreferenceState(next);
    try {
      await setAppearance(next);
    } catch (e) {
      // The pick still applies for this session; it just won't be remembered.
      console.warn('Saving the appearance failed:', e);
    }
  }, []);

  const value = useMemo(() => ({ preference, scheme, setPreference }), [preference, scheme, setPreference]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
  return useContext(AppearanceContext);
}
