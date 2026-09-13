import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
 * Shared reactive app-lock preference — without this, Settings writing the
 * flag straight to the database would have no way to reach the already-mounted
 * root layout's own local state, so toggling it on would silently do nothing
 * until the app was fully killed and relaunched.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const [lockEnabled, setLockEnabledState] = useState(false);

  useEffect(() => {
    // A rejection here already left state at its initial `false` before
    // this fix (since `setLockEnabledState` simply never ran) — this only
    // removes the resulting unhandled-promise-rejection, it doesn't change
    // that fallback behavior.
    getAppLockEnabled()
      .then(setLockEnabledState)
      .catch(() => {});
  }, []);

  const setLockEnabled = (enabled: boolean) => {
    setLockEnabledState(enabled);
    void setAppLockEnabled(enabled);
  };

  return (
    <AppLockContext.Provider value={{ lockEnabled, setLockEnabled }}>{children}</AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  return useContext(AppLockContext);
}
