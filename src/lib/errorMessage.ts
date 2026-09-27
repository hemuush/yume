/**
 * The text to show for anything thrown: its `message` if it has one, else
 * the value itself as text. Exactly what the app's catch blocks did inline
 * with `errorMessage(e)`, without typing the error as `any`.
 */
export function errorMessage(e: unknown): string {
  return String((e as { message?: unknown } | null | undefined)?.message ?? e);
}
