/**
 * Runs `task` once the JS thread is idle, but no later than `timeoutMs`, so work that must happen (catch-up,
 * reminder rebuilds) is never starved by a busy screen. Replaces InteractionManager.runAfterInteractions, which
 * React Native 0.87 removed; requestIdleCallback is its documented successor.
 *
 * Never throws: in the new architecture requestIdleCallback is a lazy lookup of a native module, and reading it
 * throws if that module is missing, which must not take startup down. The task then runs on a timer instead.
 */
export function runWhenIdle(task: () => void, timeoutMs = 2000): void {
  try {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => task(), { timeout: timeoutMs });
      return;
    }
  } catch {
    // Fall through to the timer.
  }
  setTimeout(task, 0);
}
