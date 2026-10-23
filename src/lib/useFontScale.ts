import { useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';

const listeners = new Set<() => void>();
let subscription: ReturnType<typeof Dimensions.addEventListener> | null = null;

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  // Shared by every Text: one OS listener, rather than one native subscription per label.
  subscription ??= Dimensions.addEventListener('change', () => {
    listeners.forEach((listener) => listener());
  });
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

function getSnapshot(): number {
  const scale = Dimensions.get('window').fontScale;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/** Current OS text scale, with one shared native listener and stable numeric snapshots. */
export function useFontScale(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
