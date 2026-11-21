import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * One function that never changes identity and always runs the latest `fn`, so a memoized child that is handed it is not
 * drawn again for every render of the parent, and a tap still acts on the state as it is now.
 */
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result
): (...args: Args) => Result {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
