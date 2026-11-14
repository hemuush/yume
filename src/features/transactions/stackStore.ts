import { useSyncExternalStore } from 'react';

/**
 * Which stacked lines ("Food & Dining ×5") are open, kept outside React state so that opening one re-renders only
 * that line. In the screen's state it re-rendered the whole screen and then the whole day before the panel could
 * start moving (about 150 ms on a mid-range phone). It lives here, not in the day, because a long list unmounts days
 * that scroll off and a stack the user opened must stay open when they come back.
 */
export type StackStore = {
  has: (key: string) => boolean;
  toggle: (key: string) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStackStore(initiallyOpen: Iterable<string> = []): StackStore {
  const open = new Set(initiallyOpen);
  const listeners = new Set<() => void>();
  return {
    has: (key) => open.has(key),
    toggle: (key) => {
      if (!open.delete(key)) open.add(key);
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

/** Whether one stack is open: the component using it re-renders when this stack opens or closes, and for no other. */
export function useStackOpen(stacks: StackStore, key: string): boolean {
  return useSyncExternalStore(stacks.subscribe, () => stacks.has(key));
}
