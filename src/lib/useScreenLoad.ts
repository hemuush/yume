import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from '@/lib/errorMessage';

/**
 * First-load bookkeeping: `loaded` (initial data looks "empty"), `loadError` instead of stale state, and a
 * `useFocusEffect` reload. `loadFn` should only fetch + `setState` (hook wraps try/catch); `useCallback` it.
 */
export function useScreenLoad(loadFn: () => Promise<void>) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      await loadFn();
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoaded(true);
    }
  }, [loadFn]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { loaded, loadError, reload };
}
