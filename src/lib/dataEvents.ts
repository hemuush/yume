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
  notify(listeners, 'transactions-changed');
}

/**
 * Signal that every setting was just replaced (a restore, or undoing one): app-wide preferences held in React
 * state (theme, hide amounts, app lock) re-read them instead of keeping the pre-restore values until relaunch.
 */
const settingsListeners = new Set<Listener>();

export function onSettingsRestored(listener: Listener): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

export function emitSettingsRestored(): void {
  notify(settingsListeners, 'settings-restored');
}

function notify(set: Set<Listener>, name: string): void {
  for (const listener of [...set]) {
    try {
      listener();
    } catch (e) {
      console.warn(`${name} listener failed:`, e);
    }
  }
}
