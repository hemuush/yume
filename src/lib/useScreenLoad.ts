import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * The "has the first load actually finished" bookkeeping that Profile,
 * Categories, and Loans (among others) each used to hand-roll separately —
 * a `loaded` flag (because the data itself starts at `[]`/`0`/`null`,
 * indistinguishable from "genuinely empty"), a `loadError` string surfaced
 * instead of silently leaving stale/default state on screen, and a
 * `useFocusEffect` that reruns the load every time the screen regains
 * focus. One copy of this, rather than one per screen, means a future
 * improvement to any of it (a minimum spinner duration, a retry button)
 * only has to be made once.
 *
 * `loadFn` should do nothing but fetch and `setState` its own data — this
 * hook wraps it in the try/catch/finally and decides `loaded`/`loadError`
 * from whether it threw. Memoize it with `useCallback` the same way you
 * would have memoized the old hand-rolled `load` function.
 */
export function useScreenLoad(loadFn: () => Promise<void>) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      await loadFn();
      setLoadError(null);
    } catch (e: any) {
      setLoadError(String(e?.message ?? e));
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
