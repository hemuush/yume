/**
 * Runs `task` once the JS thread is idle, but no later than `timeoutMs`, so work that must happen (catch-up,
 * reminder rebuilds) is never starved by a busy screen. Replaces InteractionManager.runAfterInteractions, which
 * React Native 0.87 removed; requestIdleCallback is its documented successor.
 */
export function runWhenIdle(task: () => void, timeoutMs = 2000): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => task(), { timeout: timeoutMs });
  } else {
    setTimeout(task, 0);
  }
}
