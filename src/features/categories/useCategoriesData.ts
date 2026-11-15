import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listCategories } from '@/db/ledger';
import { reuseUnchanged } from '@/lib/stableData';
import { useScreenLoad } from '@/lib/useScreenLoad';
import type { Category } from '@/types';

const NONE: Category[] = [];

/**
 * What the Categories page reads: every category, archived ones too, reloaded when the page is shown after a write. A
 * category whose row did not change stays the very same object, a reload that found nothing new sets no state, and the
 * lists made from it (active, archived, by kind) keep their identity until the categories change.
 */
export function useCategoriesData() {
  const [allCategories, setAllCategories] = useState(NONE);
  // What is held, so a reload that found nothing new sets no state (React still draws a component once for a state
  // update that changes nothing).
  const held = useRef(NONE);
  // Only the newest load may land, and none after the page is gone.
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    []
  );
  const loadCategories = useCallback(async () => {
    const id = ++request.current;
    const list = await listCategories(true);
    if (id !== request.current) return;
    const next =
      list.length === 0 && held.current.length === 0 ? held.current : reuseUnchanged(held.current, list);
    if (next === held.current) return;
    held.current = next;
    setAllCategories(next);
  }, []);
  const { loaded, hasData, loadError, reload } = useScreenLoad(loadCategories);
  const lists = useMemo(() => {
    const active = allCategories.filter((c) => !c.archived);
    return {
      active,
      archived: allCategories.filter((c) => c.archived),
      expense: active.filter((c) => c.kind === 'expense'),
      income: active.filter((c) => c.kind === 'income'),
    };
  }, [allCategories]);
  return { allCategories, ...lists, loaded, hasData, loadError, reload };
}
