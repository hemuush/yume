/**
 * Text for anything thrown: its `message` if it has one, else the value as text; avoids typing errors as
 * `any`.
 */
export function errorMessage(e: unknown): string {
  return String((e as { message?: unknown } | null | undefined)?.message ?? e);
}
