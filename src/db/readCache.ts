import { getDataVersion, isDataVersionTracked } from './dataVersion';

/** Shares reads by key/data version for one minute. Callers must not mutate shared results. */
const MAX_AGE_MS = 60_000;
/** Plenty for the handful of reads that use this; the oldest goes first. */
const MAX_ENTRIES = 50;

const entries = new Map<string, { version: number; at: number; value: Promise<unknown> }>();

export function cachedRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  if (!isDataVersionTracked()) return read();
  const version = getDataVersion();
  const now = Date.now();
  const hit = entries.get(key);
  const age = hit ? now - hit.at : NaN;
  if (hit && hit.version === version && age >= 0 && age < MAX_AGE_MS) return hit.value as Promise<T>;
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
