/**
 * The entries you just saved on Add, so the lists you land back on (Home's
 * recent activity, Activity) can glow that row once and show you where it
 * went (the Quiet motion sign-off). In memory only: a relaunch forgets it,
 * and so does a minute passing.
 */

/** How long after Save a row still counts as "just added". */
export const JUST_ADDED_WINDOW_MS = 60_000;

/** A place that shows rows: each glows a given entry at most once. */
export type JustAddedSurface = 'home' | 'activity';

const entries = new Map<string, { at: number; played: Set<JustAddedSurface> }>();
let version = 0;
const listeners = new Set<() => void>();

/** Called by Add after a save or an edit. */
export function markJustAdded(ids: string[], now: number = Date.now()): void {
  if (ids.length === 0) return;
  for (const id of ids) entries.set(id, { at: now, played: new Set() });
  version++;
  listeners.forEach((l) => l());
}

/**
 * Whether `surface` should glow one of `ids` now. True at most once per
 * entry per surface: it's marked played as it answers.
 */
export function takeJustAdded(ids: string[], surface: JustAddedSurface, now: number = Date.now()): boolean {
  let hit = false;
  for (const id of ids) {
    const e = entries.get(id);
    if (!e) continue;
    if (now - e.at > JUST_ADDED_WINDOW_MS) {
      entries.delete(id);
      continue;
    }
    if (e.played.has(surface)) continue;
    e.played.add(surface);
    hit = true;
  }
  return hit;
}

/** For useSyncExternalStore: rows re-check when something new is marked (an edit keeps its row mounted). */
export function subscribeJustAdded(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function justAddedVersion(): number {
  return version;
}

/** Test hook. */
export function resetJustAdded(): void {
  entries.clear();
  version = 0;
}
