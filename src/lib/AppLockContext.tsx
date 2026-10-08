import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { getAppLockEnabled, setAppLockEnabled } from '@/db/settings';
import { onSettingsRestored } from '@/lib/dataEvents';
import { showAlert } from '@/components/AppDialog';
import { errorMessage } from '@/lib/errorMessage';

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
    const read = () =>
      getAppLockEnabled()
        .then(setLockEnabledState)
        .catch(() => {});
    void read();
    // A restore can bring the lock preference back (a new phone takes the backup's).
    return onSettingsRestored(() => void read());
  }, []);

  const setLockEnabled = useCallback((enabled: boolean) => {
    setLockEnabledState(enabled);
    // A failed write would leave the switch on while the lock never applies on the next launch: undo and say.
    Promise.resolve(setAppLockEnabled(enabled)).catch((e) => {
      setLockEnabledState(!enabled);
      showAlert("Couldn't change the app lock", errorMessage(e));
    });
  }, []);

  const value = useMemo(() => ({ lockEnabled, setLockEnabled }), [lockEnabled, setLockEnabled]);

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockContextValue {
  return useContext(AppLockContext);
}
