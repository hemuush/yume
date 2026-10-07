import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from '@/lib/errorMessage';
import { useFreshness } from '@/lib/useFreshness';

/**
 * First-load bookkeeping: `loaded` (initial data looks "empty"), `loadError` instead of stale state, and a
 * `useFocusEffect` reload. `loadFn` should only fetch + `setState` (hook wraps try/catch); `useCallback` it.
 * `skipWhenUnchanged`: a screen that shows only database data skips the focus reload when nothing has been
 * written since its last successful load (see useFreshness); `reload()` always runs.
 */
export function useScreenLoad(loadFn: () => Promise<void>, opts: { skipWhenUnchanged?: boolean } = {}) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const skipWhenUnchanged = !!opts.skipWhenUnchanged;
  const freshness = useFreshness();

  const latestCall = useRef(0);

  // Only the newest call may touch `loadError`/`loaded`, so a slow older load can't overwrite a newer result.
  // Resolves true when this call's load succeeded and is still the latest.
  const run = useCallback(async (): Promise<boolean> => {
    const call = ++latestCall.current;
    let ok = false;
    try {
      await loadFn();
      ok = true;
      if (call === latestCall.current) setLoadError(null);
    } catch (e) {
      if (call === latestCall.current) setLoadError(errorMessage(e));
    } finally {
      if (call === latestCall.current) setLoaded(true);
    }
    return ok && call === latestCall.current;
  }, [loadFn]);
  const reload = useCallback(async () => {
    await run();
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      if (skipWhenUnchanged && freshness.isFresh([run])) return;
      const started = freshness.start([run]);
      void run().then((ok) => {
        if (ok) freshness.commit(started);
      });
    }, [run, skipWhenUnchanged, freshness])
  );

  return { loaded, loadError, reload };
}
