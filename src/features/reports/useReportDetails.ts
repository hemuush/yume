import { useCallback, useEffect, useState } from 'react';
import {
  getDailyExpenseTotals,
  getSubcategoryBreakdown,
  getAccountBreakdown,
  getLargestExpenses,
  type LargestExpense,
  type AccountBreakdownItem,
  type CategoryBreakdownItem,
  type DailyExpensePoint,
} from '@/db/reports';
import { toLocalIsoDate } from '@/lib/date';
import { errorMessage } from '@/lib/errorMessage';
import { windowRange, type ReportWindow } from '@/lib/period';

/** How many single expenses "Biggest spends" lists. */
export const BIGGEST_COUNT = 5;

export type CategoryGroup = 'category' | 'account';

/**
 * What Reports reads on top of a period's main load, each tied to what is open: the days of the category the heatmap
 * is narrowed to, the subcategories of the category picked in Breakdown, where the money went by account, and the
 * period's biggest single expenses. Each is fetched once the period's data has landed (`ready`), and again after each
 * fresh load of it (`version`); results carry the key they were fetched for, so one for another period, flow or filter
 * is never shown in place of the current one.
 */
export function useReportDetails({
  cursor,
  cursorKey,
  hideAmounts,
  ready,
  version,
  flow,
  group,
  catFilter,
  selectedCat,
}: {
  cursor: ReportWindow;
  cursorKey: string;
  hideAmounts: boolean;
  /** The period's own data has landed. */
  ready: boolean;
  /** Counts the loads that landed. */
  version: number;
  flow: 'expense' | 'income';
  group: CategoryGroup;
  catFilter: string | null;
  selectedCat: string | null;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [retries, setRetries] = useState(0);
  const setError = useCallback((key: string, message: string | null) => {
    setErrors((old) => {
      const next = { ...old };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  }, []);
  const retry = useCallback(() => {
    setErrors({});
    setRetries((n) => n + 1);
  }, []);
  useEffect(() => {
    setErrors({});
  }, [cursorKey, hideAmounts, catFilter, selectedCat, flow, group]);

  // The filtered heatmap's days, reloaded with each fresh load of the period.
  const [filtered, setFiltered] = useState<{ id: string; daily: DailyExpensePoint[] } | null>(null);
  const clearFiltered = useCallback(() => setFiltered(null), []);
  useEffect(() => {
    if (catFilter == null || !ready) return;
    let live = true;
    setFiltered(null);
    getDailyExpenseTotals(windowRange(cursor), hideAmounts, catFilter)
      .then((d) => live && setFiltered({ id: catFilter, daily: d }))
      .catch((e) => {
        if (live) setError('heatmap', errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [catFilter, cursor, hideAmounts, ready, version, retries, setError]);

  // The picked category's subcategories.
  const [split, setSplit] = useState<{ id: string; items: CategoryBreakdownItem[] } | null>(null);
  useEffect(() => {
    if (selectedCat == null || !ready) return;
    let live = true;
    setSplit(null);
    getSubcategoryBreakdown(selectedCat, windowRange(cursor), flow)
      .then((items) => live && setSplit({ id: selectedCat, items }))
      .catch((e) => {
        if (live) setError('split', errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [selectedCat, cursor, flow, ready, version, retries, setError]);

  // Where the period's spending (or income) went, by account.
  const [accounts, setAccounts] = useState<{ key: string; items: AccountBreakdownItem[] } | null>(null);
  const accountsKey = `${cursorKey}|${flow}|${hideAmounts}`;
  useEffect(() => {
    if (group !== 'account' || !ready) return;
    let live = true;
    setAccounts(null);
    getAccountBreakdown(windowRange(cursor), flow, hideAmounts)
      .then((items) => live && setAccounts({ key: accountsKey, items }))
      .catch((e) => {
        if (live) setError('accounts', errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [group, cursor, flow, hideAmounts, accountsKey, ready, version, retries, setError]);

  // The period's biggest single expenses, up to today (entries logged ahead aren't spent yet).
  const [largest, setLargest] = useState<{ key: string; items: LargestExpense[] } | null>(null);
  const largestKey = `${cursorKey}|${hideAmounts}|${catFilter ?? ''}`;
  useEffect(() => {
    if (!ready) return;
    let live = true;
    setLargest(null);
    const r = windowRange(cursor);
    const today = toLocalIsoDate(new Date());
    getLargestExpenses(
      { start: r.start, end: r.end < today ? r.end : today },
      BIGGEST_COUNT,
      hideAmounts,
      catFilter ?? undefined
    )
      .then((items) => live && setLargest({ key: largestKey, items }))
      .catch((e) => {
        if (live) setError('largest', errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [cursor, hideAmounts, catFilter, largestKey, ready, version, retries, setError]);

  return {
    errors,
    retry,
    filtered,
    clearFiltered,
    split,
    accounts,
    accountsKey,
    largest,
    largestKey,
  };
}
