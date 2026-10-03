/**
 * The row a write just touched, read back — or a plain error if it's gone (e.g. deleted on another screen)
 * instead of a row mapper crashing on `null`.
 */
export function found<T>(row: T | null, what: string): T {
  if (!row) throw new Error(`This ${what} no longer exists.`);
  return row;
}
