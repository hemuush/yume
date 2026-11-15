import { useCallback, useEffect, useRef, useState } from 'react';
import { listBudgetsForMonth, listLapsedBudgets, type BudgetProgress, type LapsedBudget } from '@/db/budgets';
import { listAccounts, listCategories } from '@/db/ledger';
import { reuseUnchanged, reuseUnchangedBy } from '@/lib/stableData';
import { useScreenLoad } from '@/lib/useScreenLoad';
import type { Account, Category } from '@/types';

interface BudgetsData {
  budgets: BudgetProgress[];
  lapsed: LapsedBudget[];
  categories: Category[];
  accounts: Account[];
}

const NONE: BudgetsData = { budgets: [], lapsed: [], categories: [], accounts: [] };

/**
 * What the Budgets page reads for a month: its budgets and their progress, the budgets that ended last month, and the
 * categories and accounts the sheets need. Reloaded when the page is shown after a write or on a new day; a load for
 * another month or privacy setting that is still in flight never lands on this one. A row that did not change stays the
 * very same object, so a reload redraws only the budgets that changed.
 */
export function useBudgetsData(periodMonth: string, hideAmounts: boolean) {
  const [data, setData] = useState(NONE);
  // What is held, so a reload that found nothing new sets no state at all.
  const held = useRef(NONE);
  const request = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current += 1;
    };
  }, []);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [periodMonth, hideAmounts]
  );

  const loadBudgets = useCallback(async () => {
    const id = ++request.current;
    const [budgets, lapsed, categories, accounts] = await Promise.all([
      listBudgetsForMonth(periodMonth, hideAmounts),
      listLapsedBudgets(periodMonth, hideAmounts),
      listCategories(true),
      listAccounts(true),
    ]);
    if (!active.current || request.current !== id) return;
    const prev = held.current;
    const next = {
      budgets: reuseUnchangedBy(prev.budgets, budgets, (b) => b.budget.id),
      lapsed: reuseUnchangedBy(prev.lapsed, lapsed, (l) => l.categoryId),
      categories: reuseUnchanged(prev.categories, categories),
      accounts: reuseUnchanged(prev.accounts, accounts),
    };
    if (
      next.budgets === prev.budgets &&
      next.lapsed === prev.lapsed &&
      next.categories === prev.categories &&
      next.accounts === prev.accounts
    )
      return;
    held.current = next;
    setData(next);
  }, [periodMonth, hideAmounts]);
  const { loaded, hasData, loadError, reload } = useScreenLoad(loadBudgets);
  return { ...data, loaded, hasData, loadError, reload };
}
