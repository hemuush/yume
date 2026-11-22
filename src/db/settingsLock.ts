/**
 * Read-modify-write settings (the "seen"/"sent"/queue lists) run one at a time: two overlapping calls would
 * otherwise both read the same old list and the second write would drop the first one's additions.
 */
let settingsLockChain: Promise<unknown> = Promise.resolve();
export function withSettingsLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = settingsLockChain.then(fn, fn);
  settingsLockChain = run.catch(() => {});
  return run;
}
