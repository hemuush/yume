import { memo, type ReactElement } from 'react';

/**
 * A section of the Add page that is drawn again only when a field of the model it reads changes. Each section declares
 * those fields once (its `*_KEYS`), and its props are typed from the same list, so it cannot read one it did not declare.
 */
export function memoByModelKeys<K extends PropertyKey, P extends { model: Record<K, unknown> }>(
  Section: (props: P) => ReactElement,
  keys: readonly K[]
) {
  return memo(Section, (prev, next) => keys.every((key) => Object.is(prev.model[key], next.model[key])));
}
