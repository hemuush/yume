import { router, Href } from 'expo-router';

/** How soon after one push a second is taken for a double tap. */
const DOUBLE_TAP_MS = 700;
let lastPushAt = 0;

/**
 * router.push that ignores a second call right after the first, so a fast double tap on + or a quick
 * action opens one Add screen, not two stacked.
 */
export function pushOnce(href: Href): void {
  const now = Date.now();
  if (now - lastPushAt < DOUBLE_TAP_MS) return;
  lastPushAt = now;
  router.push(href);
}
