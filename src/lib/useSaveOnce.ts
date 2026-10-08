import { useCallback, useRef } from 'react';

/**
 * Wraps a form's save so a second tap while it's still running does nothing. `disabled={saving}` alone
 * isn't enough: two taps can land in the same frame, before the re-render that disables the button.
 */
export function useSaveOnce<T extends unknown[]>(save: (...args: T) => Promise<unknown>) {
  const running = useRef(false);
  return useCallback(
    async (...args: T) => {
      if (running.current) return;
      running.current = true;
      try {
        await save(...args);
      } finally {
        running.current = false;
      }
    },
    [save]
  );
}
