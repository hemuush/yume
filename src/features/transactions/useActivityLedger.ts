import { useCallback, useEffect, useRef, useState } from 'react';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { getRangeComparison, type PeriodComparison } from '@/db/reports';
import type { Account, Category, Transaction } from '@/types';
import { toLocalIsoDate } from '@/lib/date';
import { errorMessage } from '@/lib/errorMessage';
import { keepIfEqual, previousRangeFor, reuseUnchanged } from './transactions.helpers';

/** How long the days that mount as a period lands take to fade in. */
const ARRIVAL_MS = 400;

/** The period the loaded entries and totals belong to. Empty dates until the first load lands. */
export interface LoadedPeriod {
  fromDate: string;
  toDate: string;
  scope: 'week' | 'month';
}

/**
 * What Activity shows of the ledger for one period: its entries, the accounts and categories they refer to, and the
 * totals against the period before. `load` fetches them; only the newest load may write, since paging week or month
 * quickly starts overlapping loads and an earlier one can finish last. Everything that came back lands in one update,
 * so the Spent card never shows one period's figure under the next one's bars.
 */
export function useActivityLedger() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  // The totals query failed: the list still loaded, so show it (with a note) rather than the skeleton forever.
  const [comparisonFailed, setComparisonFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The period the rows and totals on screen belong to: the pill moves at once, this catches up when the
  // period's data lands, and the Spent card and its bars follow it (never the pill).
  const [loadedPeriod, setLoadedPeriod] = useState<LoadedPeriod>(() => ({
    fromDate: '',
    toDate: '',
    scope: 'week',
  }));
  const loadSeq = useRef(0);

  // True for a moment after a period's entries land: the days mounted then fade in with the Spent strip's glide,
  // instead of snapping in under it (and instead of replacing the loading placeholder in one frame). Days that
  // scroll into view later mount with it off, so scrolling a long month never flickers. A ref, not state: only the
  // days mounting right now read it, and turning it off again must not redraw the whole screen for nothing.
  const arriving = useRef(false);
  const arriveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (arriveTimer.current) clearTimeout(arriveTimer.current);
    },
    []
  );
  const isArriving = useCallback(() => arriving.current, []);

  const load = useCallback(async (range: { fromDate: string; toDate: string }, scope: 'week' | 'month') => {
    const seq = ++loadSeq.current;
    let tx: Transaction[];
    let loadedAccounts: Account[];
    let loadedCategories: Category[];
    try {
      const [rows, accs, cats] = await Promise.all([
        listTransactions(range),
        listAccounts(true),
        listCategories(true),
      ]);
      if (seq !== loadSeq.current) return false;
      tx = rows;
      loadedAccounts = accs;
      loadedCategories = cats;
      setLoadError(null);
    } catch (e) {
      if (seq !== loadSeq.current) return false;
      // A transient DB failure otherwise left stale/empty data with no hint anything went wrong (as on
      // other tabs).
      setLoadError(errorMessage(e));
      return false;
    }
    // Caught separately: the totals only feed the Spent figure and its change, so their failure must not
    // blank the list.
    let cmp: PeriodComparison | null = null;
    try {
      const prev = previousRangeFor(range, scope, toLocalIsoDate(new Date()));
      cmp = await getRangeComparison(
        { start: range.fromDate, end: range.toDate },
        { start: prev.fromDate, end: prev.toDate },
        scope
      );
    } catch {
      cmp = null;
    }
    if (seq !== loadSeq.current) return false;
    // Set before the state below lands, which is when the new days mount and read it.
    arriving.current = true;
    if (arriveTimer.current) clearTimeout(arriveTimer.current);
    arriveTimer.current = setTimeout(() => {
      arriving.current = false;
    }, ARRIVAL_MS);
    // A reload that found nothing new changes nothing held here, so no day of the list redraws for it.
    setAccounts((prev) => keepIfEqual(prev, loadedAccounts));
    setCategories((prev) => keepIfEqual(prev, loadedCategories));
    setTransactions((prev) => reuseUnchanged(prev, tx));
    setComparison(cmp);
    setComparisonFailed(cmp == null);
    setLoadedPeriod({ fromDate: range.fromDate, toDate: range.toDate, scope });
    return cmp != null;
  }, []);

  return {
    transactions,
    accounts,
    categories,
    comparison,
    comparisonFailed,
    loadError,
    loadedPeriod,
    isArriving,
    load,
  };
}
