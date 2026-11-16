/**
 * Which of the two modes the app is drawn in, as plain module state (no React), so a style sheet or a colour
 * helper can ask "light or dark?" without a hook. `applyScheme` is the one writer; the `AppearanceProvider` calls
 * it from what the person chose and the phone's own setting.
 */

export type Scheme = 'light' | 'dark';
/** What the person picked: follow the phone, or fix one mode. */
export type AppearancePreference = 'system' | 'light' | 'dark';

export const APPEARANCE_PREFERENCES: readonly AppearancePreference[] = ['system', 'light', 'dark'];

let current: Scheme = 'light';
/** Bumped on every change, so a cached style sheet knows it was made for another mode. */
let version = 0;
const listeners = new Set<() => void>();

export function getScheme(): Scheme {
  return current;
}

export function getSchemeVersion(): number {
  return version;
}

/** Returns whether the mode changed. */
export function applyScheme(next: Scheme): boolean {
  if (next === current) return false;
  current = next;
  version += 1;
  listeners.forEach((listener) => listener());
  return true;
}

export function subscribeScheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** The mode a preference means right now, given what the phone says. */
export function resolveScheme(preference: AppearancePreference, system: Scheme | null | undefined): Scheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
