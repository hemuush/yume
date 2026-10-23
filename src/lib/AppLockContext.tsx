import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { getAppLockEnabled, setAppLockEnabled } from '@/db/settings';
import { onSettingsRestored } from '@/lib/dataEvents';

interface AppLockContextValue {
  lockEnabled: boolean;
  setLockEnabled: (enabled: boolean) => void;
  lockSaveError: { attempt: number; message: string } | null;
  acknowledgeLockSaveError: (attempt: number) => void;
}

const AppLockContext = createContext<AppLockContextValue>({
  lockEnabled: false,
  setLockEnabled: () => {},
  lockSaveError: null,
  acknowledgeLockSaveError: () => {},
});

/**
 * Shared reactive app-lock preference: Settings writing the flag straight to the DB can't reach the root
 * layout's local state, so the toggle would do nothing until the app was killed and relaunched.
 */
export function AppLockProvider({
  children,
  initialLockEnabled = false,
}: {
  children: ReactNode;
  initialLockEnabled?: boolean;
}) {
  const [lockEnabled, setLockEnabledState] = useState(initialLockEnabled);
  const [lockSaveError, setLockSaveError] = useState<AppLockContextValue['lockSaveError']>(null);
  const current = useRef(initialLockEnabled);
  const generation = useRef(0);
  const invalidateReads = useCallback(() => {
    generation.current += 1;
  }, []);
  const apply = useCallback((enabled: boolean) => {
    current.current = enabled;
    setLockEnabledState(enabled);
  }, []);

  useEffect(() => {
    // Keep startup's verified preference if a later read fails. Ignore reads overtaken by a toggle/restore.
    const read = () => {
      const call = ++generation.current;
      return getAppLockEnabled()
        .then((enabled) => {
          if (call === generation.current) apply(enabled);
        })
        .catch(() => {});
    };
    void read();
    // A restore can bring the lock preference back (a new phone takes the backup's).
    const unsubscribe = onSettingsRestored(() => {
      setLockSaveError(null);
      void read();
    });
    return () => {
      invalidateReads();
      unsubscribe();
    };
  }, [apply, invalidateReads]);

  const setLockEnabled = useCallback(
    (enabled: boolean) => {
      const previous = current.current;
      const call = ++generation.current;
      setLockSaveError(null);
      apply(enabled);
      // A failed write would leave the switch on while the lock never applies on the next launch: undo and say.
      Promise.resolve(setAppLockEnabled(enabled)).catch((e) => {
        console.error('App lock preference could not be saved:', e);
        if (call !== generation.current) return;
        apply(previous);
        // The capture guard may have unmounted the dialog host. Keep feedback until it returns.
        setLockSaveError({
          attempt: call,
          message: 'Your previous app lock setting has been restored. Try again to save your choice.',
        });
      });
    },
    [apply]
  );

  const acknowledgeLockSaveError = useCallback((attempt: number) => {
    setLockSaveError((error) => (error?.attempt === attempt ? null : error));
  }, []);
  const value = useMemo(
    () => ({ lockEnabled, setLockEnabled, lockSaveError, acknowledgeLockSaveError }),
    [lockEnabled, setLockEnabled, lockSaveError, acknowledgeLockSaveError]
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockContextValue {
  return useContext(AppLockContext);
}
