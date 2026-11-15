import { useMemo } from 'react';

// Keeping what a reload did not change as the very same objects: a screen can then skip redrawing whatever is made
// only of them (React compares by identity).

/** `next`, unless it holds exactly what `prev` does: then `prev` itself, so a reload that found nothing new changes no state. */
export function keepIfEqual<T>(prev: T, next: T): T {
  return prev === next || JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
}

/**
 * The reloaded rows, each replaced by the one already held when it has the same key and exactly the same fields. A day
 * made of unchanged rows is then still made of the same objects, and does not redraw; only what changed does.
 */
export function reuseUnchangedBy<T>(prev: T[], next: T[], keyOf: (row: T) => string): T[] {
  if (prev.length === 0) return next;
  const before = new Map(prev.map((row) => [keyOf(row), row]));
  let allSame = prev.length === next.length;
  const out = next.map((row, i) => {
    const old = before.get(keyOf(row));
    const kept = old && JSON.stringify(old) === JSON.stringify(row) ? old : row;
    if (allSame && kept !== prev[i]) allSame = false;
    return kept;
  });
  return allSame ? prev : out;
}

/** `reuseUnchangedBy` for rows keyed by their `id`. */
export function reuseUnchanged<T extends { id: string }>(prev: T[], next: T[]): T[] {
  return reuseUnchangedBy(prev, next, (row) => row.id);
}

/**
 * The reloaded entries of a map, each replaced by the one already held when it holds the same things: the same map when
 * nothing changed, otherwise a new map whose unchanged entries are still the very same objects.
 */
export function keepEntriesIfEqual<T>(
  prev: Record<string, T> | undefined,
  next: Record<string, T>
): Record<string, T> {
  if (!prev) return next;
  const keys = Object.keys(next);
  let changed = keys.length !== Object.keys(prev).length;
  const out: Record<string, T> = {};
  for (const key of keys) {
    const kept = key in prev ? keepIfEqual(prev[key], next[key]) : next[key];
    if (kept !== prev[key]) changed = true;
    out[key] = kept;
  }
  return changed ? out : prev;
}

/** Whether two lists hold the very same objects in the same order. */
export function sameElements<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The same Set object for as long as the set holds the same members, however often it is rebuilt. */
export function useStableSet<T>(set: ReadonlySet<T>): ReadonlySet<T> {
  const key = [...set].sort().join('\u0000');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the members are the key
  return useMemo(() => set, [key]);
}

/** The same value (object or list) for as long as it holds the same things, however often it is rebuilt. */
export function useStableValue<T>(value: T): T {
  const key = JSON.stringify(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- what it holds is the key
  return useMemo(() => value, [key]);
}

/**
 * `next`, with each field replaced by the one already held when it holds the same things: the same object when nothing
 * changed, otherwise a new object whose unchanged fields are still the very same objects.
 */
export function keepFieldsIfEqual<T extends object>(prev: T | null, next: T): T {
  if (!prev) return next;
  const keys = Object.keys(next) as (keyof T)[];
  let changed = keys.length !== Object.keys(prev).length;
  const out = { ...next };
  for (const key of keys) {
    const kept = keepIfEqual(prev[key], next[key]);
    if (kept !== prev[key]) changed = true;
    out[key] = kept;
  }
  return changed ? out : prev;
}
