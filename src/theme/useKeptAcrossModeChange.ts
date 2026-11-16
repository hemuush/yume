import { useEffect, useState } from 'react';
import { schemeChangedJustNow } from './scheme';

const kept = new Map<string, unknown>();

/**
 * `useState` for a small choice that should survive the screen being drawn again for a colour-mode change (the tab
 * a person is on): the value is picked up again only when the screen was made because the mode changed, never when
 * it is opened afresh, so leaving and coming back still starts from `initial`.
 */
export function useKeptAcrossModeChange<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() =>
    schemeChangedJustNow() && kept.has(key) ? (kept.get(key) as T) : initial
  );
  useEffect(() => {
    kept.set(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
