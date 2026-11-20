import { getSchemeVersion } from './scheme';

/**
 * A style sheet that is made again when the mode changes. A module-level `StyleSheet.create({ color:
 * theme.colors.ink })` is evaluated once, when the file loads, so it would keep the mode it was loaded in; wrapped
 * in this it is evaluated again on the first access after each change of mode, and callers keep writing
 * `styles.row` as before. Within one mode every access returns the same objects (so memoized rows still compare
 * equal); the factory runs only when the mode has changed since the last access.
 *
 * Each style name is a plain getter property on an ordinary object, so spreading it, listing its keys, freezing it
 * or handing it to a library all work as they do on a normal object. (A `Proxy` was tried first and breaks when
 * something freezes it: React and react-native-web do.) The names come from the first run; a factory must return
 * the same names in every mode.
 */
export function themedStyles<T extends object>(factory: () => T): T {
  let cache = factory();
  let madeFor = getSchemeVersion();
  const current = (): Record<PropertyKey, unknown> => {
    const now = getSchemeVersion();
    if (now !== madeFor) {
      cache = factory();
      madeFor = now;
    }
    return cache as Record<PropertyKey, unknown>;
  };
  const sheet: Record<PropertyKey, unknown> = {};
  for (const key of Reflect.ownKeys(cache)) {
    Object.defineProperty(sheet, key, { enumerable: true, configurable: true, get: () => current()[key] });
  }
  return sheet as T;
}

/**
 * The same idea for a constant that is not a style sheet: a map of tone colours, a text style, a shadow. Written
 * as `themedValue(() => ({ ... theme.colors.x ... }))` it is evaluated again after a change of mode, so it never
 * keeps the colours of the mode it was loaded in. Use it for objects; for a list, build the list inside the
 * function that needs it.
 */
export const themedValue = themedStyles;
