import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { toLocalIsoDate } from '@/lib/date';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let subscription: ReturnType<typeof AppState.addEventListener> | null = null;
const snapshot = () => toLocalIsoDate(new Date());
const notify = () => listeners.forEach((listener) => listener());

function arm() {
  clearTimeout(timer);
  const now = new Date();
  timer = setTimeout(
    () => {
      notify();
      arm();
    },
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 50
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscription) {
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') arm();
    subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') {
        notify();
        arm();
      }
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      subscription?.remove();
      subscription = null;
    }
  };
}

/** One local-day timer/listener shared by every mounted budget row and goal screen. */
export function useToday(): string {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
