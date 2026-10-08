import * as ExpoRouter from 'expo-router';
import type { RefObject } from 'react';

// Resolved once: a test's partial expo-router mock may not include it, and then this is a no-op.
const useScrollToTop: (ref: RefObject<unknown>) => void =
  (ExpoRouter.useScrollToTop as ((ref: RefObject<unknown>) => void) | undefined) ?? (() => {});

/** Re-tapping the tab you're already on scrolls its list back to the top, as Android users expect. */
export function useTabScrollToTop(ref: RefObject<unknown>): void {
  useScrollToTop(ref);
}
