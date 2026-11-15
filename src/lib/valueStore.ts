import { useSyncExternalStore } from 'react';

/**
 * A value held outside React state. Reading it with `useStoreValue` redraws only the component that reads it, so what a
 * screen keeps here (which sheet is open, and for what) can change without redrawing the page behind the sheet.
 */
export interface ValueStore<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createValueStore<T>(initial: T): ValueStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The store's current value; the component is drawn again when it changes. */
export function useStoreValue<T>(store: Pick<ValueStore<T>, 'get' | 'subscribe'>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
