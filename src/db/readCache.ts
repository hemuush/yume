import { getDataVersion, isDataVersionTracked } from './dataVersion';

/**
 * Shares one heavy read between everything that asks for it until the data changes. Home and its Needs you
 * list, for example, both want this month's totals, this month's budgets and the card cycles; without this
 * each was computed twice per visit, every query waiting its turn in the one database queue.
 *
 * Keyed by the caller (name + arguments) and the data version, so any write makes every entry stale. Results
 * are shared objects: callers must not change them in place. Also capped by age, for reads that depend on
 * the clock as well as the data. Off in tests that bring their own database (see dataVersion.ts).
 */
const MAX_AGE_MS = 60_000;
/** Plenty for the handful of reads that use this; the oldest goes first. */
const MAX_ENTRIES = 50;

const entries = new Map<string, { version: number; at: number; value: Promise<unknown> }>();

export function cachedRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  if (!isDataVersionTracked()) return read();
  const version = getDataVersion();
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.version === version && now - hit.at < MAX_AGE_MS) return hit.value as Promise<T>;
  const value = read();
  entries.delete(key);
  entries.set(key, { version, at: now, value });
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
  // A failed read is never handed out again: the next caller tries afresh.
  value.catch(() => {
    if (entries.get(key)?.value === value) entries.delete(key);
  });
  return value;
}

/** Test hook. */
export function clearReadCache(): void {
  entries.clear();
}
