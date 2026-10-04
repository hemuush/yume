import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from '@/lib/errorMessage';

/**
 * First-load bookkeeping: `loaded` (initial data looks "empty"), `loadError` instead of stale state, and a
 * `useFocusEffect` reload. `loadFn` should only fetch + `setState` (hook wraps try/catch); `useCallback` it.
 */
export function useScreenLoad(loadFn: () => Promise<void>) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const latestCall = useRef(0);

  // Only the newest call may touch `loadError`/`loaded`, so a slow older load can't overwrite a newer result.
  const reload = useCallback(async () => {
    const call = ++latestCall.current;
    try {
      await loadFn();
      if (call === latestCall.current) setLoadError(null);
    } catch (e) {
      if (call === latestCall.current) setLoadError(errorMessage(e));
    } finally {
      if (call === latestCall.current) setLoaded(true);
    }
  }, [loadFn]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { loaded, loadError, reload };
}
