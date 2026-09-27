/**
 * The row a write just touched, read back — or a plain error when it's
 * gone (an update to something deleted a moment ago on another screen),
 * rather than a row mapper crashing on `null`.
 */
export function found<T>(row: T | null, what: string): T {
  if (!row) throw new Error(`This ${what} no longer exists.`);
  return row;
}
