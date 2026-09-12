import { useState } from 'react';
import { haptics } from './haptics';

/**
 * Shared behavior behind every "list that might be longer than fits" spot in
 * the app (Transactions' `DayCard`, Home's `Upcoming` section): show at most
 * `cap` items, and hand back whatever's left over so the caller can render
 * its own "+N more" affordance instead of silently dropping it. Each screen
 * keeps its own row/affordance markup — those differ enough (a day-card row
 * vs. an Upcoming row) that only the cap/expand bookkeeping is worth sharing,
 * not the JSX.
 */
export function useCappedList<T>(items: T[], cap: number) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, cap);
  const hidden = items.slice(cap);

  const expand = () => {
    haptics.tap();
    setExpanded(true);
  };

  return { shown, hidden, expanded, expand };
}
