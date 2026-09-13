import { useState } from 'react';
import { haptics } from './haptics';

/**
 * Shared behavior behind a "list that might be longer than fits" spot that
 * stays mounted for as long as it's expanded — Home's `Upcoming` section is
 * the case this fits: show at most `cap` items, and hand back whatever's
 * left over so the caller can render its own "+N more" affordance instead
 * of silently dropping it.
 *
 * Not a fit for a spot whose container can unmount and remount the
 * component while the screen is still open — Transactions' `DayCard` looked
 * like a second consumer, but it's rendered inside a virtualized `FlatList`,
 * so local "expanded" state here would reset to collapsed every time a row
 * scrolls off- and back on-screen. That one instead keeps `expanded` up in
 * the parent, keyed by day, and passes it down as a controlled prop.
 */
export function useCappedList<T>(items: T[], cap: number) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, cap);
  // Nothing reads `hidden` once expanded (the caller's "+N more" row is
  // gone by then) — skip the slice/allocation for a case every render of an
  // already-expanded list would otherwise pay for nothing.
  const hidden = expanded ? [] : items.slice(cap);

  const expand = () => {
    haptics.tap();
    setExpanded(true);
  };

  return { shown, hidden, expanded, expand };
}
