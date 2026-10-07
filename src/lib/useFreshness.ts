import { useMemo, useRef } from 'react';
import { getDataVersion, isDataVersionTracked } from '@/db/dataVersion';
import { toLocalIsoDate } from '@/lib/date';

/** Past this, a screen reloads on focus anyway, for anything that moves with the clock (a due date, "today"). */
const FRESH_FOR_MS = 5 * 60_000;

interface Loaded {
  deps: readonly unknown[];
  version: number;
  day: string;
  at: number;
}

/**
 * Lets a screen skip reloading on focus when nothing it shows can have changed: no write since its last
 * successful load (data version), same day, same inputs (`deps`, e.g. the period and the load function), and
 * not older than a few minutes. Coming back to a tab is then instant instead of re-running every query.
 *
 * `start` snapshots the version before a load (a write landing mid-load makes the next focus reload);
 * `commit` keeps it only once the load has succeeded.
 */
export function useFreshness() {
  const last = useRef<Loaded | null>(null);
  return useMemo(
    () => ({
      isFresh(deps: readonly unknown[]): boolean {
        const l = last.current;
        return (
          isDataVersionTracked() &&
          l !== null &&
          l.version === getDataVersion() &&
          l.day === toLocalIsoDate(new Date()) &&
          Date.now() - l.at < FRESH_FOR_MS &&
          l.deps.length === deps.length &&
          l.deps.every((d, i) => Object.is(d, deps[i]))
        );
      },
      start(deps: readonly unknown[]): Loaded {
        return { deps, version: getDataVersion(), day: toLocalIsoDate(new Date()), at: Date.now() };
      },
      commit(loaded: Loaded): void {
        last.current = loaded;
      },
    }),
    []
  );
}
