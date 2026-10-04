import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { getAppLockEnabled, setAppLockEnabled } from '@/db/settings';

interface AppLockContextValue {
  lockEnabled: boolean;
  setLockEnabled: (enabled: boolean) => void;
}

const AppLockContext = createContext<AppLockContextValue>({
  lockEnabled: false,
  setLockEnabled: () => {},
});

/**
 * Shared reactive app-lock preference: Settings writing the flag straight to the DB can't reach the root
 * layout's local state, so the toggle would do nothing until the app was killed and relaunched.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const [lockEnabled, setLockEnabledState] = useState(false);

  useEffect(() => {
    // A rejection already left state at its initial `false`; this only avoids the unhandled-promise-rejection
    // and doesn't change that fallback.
    getAppLockEnabled()
      .then(setLockEnabledState)
      .catch(() => {});
  }, []);

  const setLockEnabled = useCallback((enabled: boolean) => {
    setLockEnabledState(enabled);
    void setAppLockEnabled(enabled);
  }, []);

  const value = useMemo(() => ({ lockEnabled, setLockEnabled }), [lockEnabled, setLockEnabled]);

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockContextValue {
  return useContext(AppLockContext);
}
