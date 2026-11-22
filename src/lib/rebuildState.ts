import { toLocalIsoDate } from './date';

/**
 * Whether the notification plan is worth working out again when the app comes to the front. Kept apart from
 * notifications.ts (which needs the native notification module) so the app's start-up can ask without loading it.
 */
let lastRebuiltAt: Date | null = null;
let lastFailed = false;

/** How long a rebuild stays good for the app coming to the foreground: writes that change content rebuild by themselves. */
const REBUILD_GOOD_MS = 6 * 60 * 60 * 1000;

/** Notes the outcome of a rebuild. */
export function recordRebuild(ok: boolean, now: Date = new Date()): void {
  lastFailed = !ok;
  if (ok) lastRebuiltAt = now;
}

/**
 * Never built, the last one failed, a new day has begun (the 14-day horizon moves) or it is a few hours old. A quick hop
 * back to the app changes nothing.
 */
export function rebuildIsStale(now: Date = new Date()): boolean {
  if (!lastRebuiltAt || lastFailed) return true;
  return (
    toLocalIsoDate(lastRebuiltAt) !== toLocalIsoDate(now) ||
    now.getTime() - lastRebuiltAt.getTime() > REBUILD_GOOD_MS
  );
}
