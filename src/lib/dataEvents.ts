/**
 * A tiny in-app signal for "transactions just changed" — for the rare write
 * that happens without leaving the current screen (the + long-press "Log
 * again" sheet saves straight from Home). Screens normally reload on focus;
 * a modal closing over them doesn't refocus anything, so without this Home
 * would keep showing the old numbers until you navigated away and back.
 * In-memory only; nothing leaves the app.
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
