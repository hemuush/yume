import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * One shared copy of the OS setting: a busy screen mounts hundreds of these hooks (a glow per Activity row),
 * and each used to make its own native call and listener. Started by the first subscriber, then kept for the
 * app's life: the one listener is cheap and the cached value stays current for later mounts.
 */
let reduceMotion = false;
let started = false;
const subscribers = new Set<() => void>();

function set(v: boolean) {
  if (v === reduceMotion) return;
  reduceMotion = v;
  subscribers.forEach((notify) => notify());
}

function start() {
  if (started) return;
  started = true;
  // A live OS change takes precedence over the slower initial native read.
  let changed = false;
  AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
    changed = true;
    set(value);
  });
  AccessibilityInfo.isReduceMotionEnabled().then(
    (value) => {
      if (!changed) set(value);
    },
    () => {}
  );
}

function subscribe(notify: () => void) {
  start();
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

const getSnapshot = () => reduceMotion;

/**
 * Tracks the OS "reduce motion" setting; hand-rolled `Animated` animations check it and skip to the end.
 * (reanimated's own `entering`/`exiting` take `ReduceMotion.System` separately.)
 */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
