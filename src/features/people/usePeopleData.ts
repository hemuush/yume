import { useCallback, useEffect, useRef, useState } from 'react';
import { listPeople, type PersonWithBalance } from '@/db/people';
import { reuseUnchanged } from '@/lib/stableData';
import { useScreenLoad } from '@/hooks/useScreenLoad';

const NONE: PersonWithBalance[] = [];

/**
 * What the Friends & family page reads: everyone with their balance, reloaded when the page is shown after a write. A
 * person whose row did not change stays the very same object, so a reload redraws only the tiles that changed, and one
 * that found nothing new sets no state at all.
 */
export function usePeopleData() {
  const [people, setPeople] = useState(NONE);
  // What is held, so a reload that found nothing new sets no state (React still draws a component once for a state
  // update that changes nothing).
  const held = useRef(NONE);
  // Only the newest load may land, and none after the page is gone: an older read that finishes late would put old
  // balances back over newer ones.
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    []
  );
  const loadPeople = useCallback(async () => {
    const id = ++request.current;
    const list = await listPeople();
    if (id !== request.current) return;
    const next =
      list.length === 0 && held.current.length === 0 ? held.current : reuseUnchanged(held.current, list);
    if (next === held.current) return;
    held.current = next;
    setPeople(next);
  }, []);
  const { loaded, hasData, loadError, reload } = useScreenLoad(loadPeople);
  return { people, loaded, hasData, loadError, reload };
}
