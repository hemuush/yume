/**
 * In-app signal that "transactions just changed" for writes that don't leave the screen (the + long-press
 * "Log again" sheet). A closing modal refocuses nothing, so Home would stay stale. In-memory only.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe; returns the unsubscribe function (hand it straight to a useEffect cleanup). */
export function onTransactionsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitTransactionsChanged(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (e) {
      console.warn('transactions-changed listener failed:', e);
    }
  }
}
