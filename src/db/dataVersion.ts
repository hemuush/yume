/**
 * A counter that goes up on every write to the database (see client.ts), so readers can tell "nothing has
 * changed since I last loaded" without asking SQLite. In-memory: a fresh launch starts again from 0.
 *
 * Only the real database bumps it. Tests that swap in their own database never do, so `isTracked()` is false
 * there and anything relying on the counter (readCache, useFreshness) simply always reads.
 */
let version = 0;
let tracked = false;

export function getDataVersion(): number {
  return version;
}

export function bumpDataVersion(): void {
  version++;
}

/** Called once the real database is open: from then on every write bumps the counter. */
export function trackDataVersion(): void {
  tracked = true;
}

export function isDataVersionTracked(): boolean {
  return tracked;
}
