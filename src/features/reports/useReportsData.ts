import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getRangeComparison,
  getMonthlyExpenseTrend,
  getNetWorthTrend,
  getMonthlyCashFlow,
  getCategoryMonthlyTotals,
  getDailyExpenseTotals,
  type PeriodComparison,
  type CashFlowPoint,
  type CategoryTrack,
  type TrendPoint,
  type NetWorthPoint,
  type DailyExpensePoint,
} from '@/db/reports';
import { listCategories, listAccounts } from '@/db/ledger';
import { listBudgetsForMonth } from '@/db/budgets';
import { findStartingBalances } from '@/db/tidyUp';
import { savingsAccountIdsOf } from '@/lib/account';
import { privateComparison } from '@/lib/privateSummary';
import { parseLocalIsoDate, toLocalIsoDate } from '@/lib/date';
import { errorMessage } from '@/lib/errorMessage';
import { isCustomWindow, previousWindowRange, rangeDays, windowRange, type ReportWindow } from '@/lib/period';
import { keepIfEqual, useStableSet } from '@/lib/stableData';
import { useFreshness } from '@/hooks/useFreshness';
import { useLocalDayRefresh } from '@/hooks/useLocalDayRefresh';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { Category } from '@/types';
import { budgetCover, type BudgetCover } from './reportsInsights';

const NO_NAMES: string[] = [];

/**
 * What Reports reads of the ledger for one period (a month, a year or a custom range): the comparison with the period
 * before, the trends behind it, the days, the categories and the month's budget. `load` fetches them together, newest
 * request winning, and Reports reloads when it is shown after a write or a new day. `loadedKey` names the period and
 * privacy setting the data belongs to, so a page never shows one period's figures under another's name; `version`
 * counts the loads that landed, for what is fetched on top of them (the biggest spends, a category's subcategories).
 * Whatever a reload did not change stays the very same object.
 */
export function useReportsData(cursor: ReportWindow, { onLoadStart }: { onLoadStart?: () => void } = {}) {
  const { hideAmounts } = usePrivacy();
  const [rawComparison, setComparison] = useState<PeriodComparison | null>(null);
  // With "hide savings & investment amounts" on, the sensitive categories are left out of every total, share and chart.
  const comparison = useMemo(
    () => privateComparison(rawComparison, hideAmounts),
    [rawComparison, hideAmounts]
  );
  const [savingsIds, setSavingsIds] = useState<ReadonlySet<string>>(new Set());
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [netWorthTrend, setNetWorthTrend] = useState<NetWorthPoint[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowPoint[]>([]);
  const [catTracks, setCatTracks] = useState<CategoryTrack[]>([]);
  const [daily, setDaily] = useState<DailyExpensePoint[]>([]);
  // The month's total budget when there is one.
  const [budget, setBudget] = useState<BudgetCover | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // Categories Tidy up reads as starting balances logged as income: the
  // Income view points at Tidy up when one of them makes up most of it.
  const [startingBalanceNames, setStartingBalanceNames] = useState<string[]>(NO_NAMES);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const requestKey = `${JSON.stringify(cursor)}|${hideAmounts}`;

  const startRef = useRef(onLoadStart);
  useEffect(() => {
    startRef.current = onLoadStart;
  });
  // Only the most recent load may write state — stepping periods quickly
  // starts overlapping loads, and an earlier one can finish last.
  const loadSeq = useRef(0);
  const load = useCallback(
    async (c: ReportWindow) => {
      const seq = ++loadSeq.current;
      startRef.current?.();
      const range = windowRange(c);
      const anchor = parseLocalIsoDate(range.end);
      // A custom range's trend reaches back over the whole range (up to two years).
      const trendMonths =
        c.granularity === 'year'
          ? 12
          : isCustomWindow(c)
            ? Math.min(24, Math.max(7, Math.ceil(rangeDays(range) / 30.44)))
            : 7;
      try {
        setStatus('loading');
        const [cmp, tr, nw, cf, ct, dy, cats, tidy, accs, bud] = await Promise.all([
          getRangeComparison(range, previousWindowRange(c), isCustomWindow(c) ? 'month' : c.granularity),
          getMonthlyExpenseTrend(trendMonths, anchor, hideAmounts),
          getNetWorthTrend(trendMonths, anchor),
          getMonthlyCashFlow(trendMonths, anchor, hideAmounts),
          getCategoryMonthlyTotals(trendMonths, anchor, hideAmounts),
          getDailyExpenseTotals(range, hideAmounts),
          listCategories(true),
          // Only the starting-balance names (to word an insight); not Tidy up's whole-ledger repeat scan.
          findStartingBalances().catch(() => null),
          listAccounts(true),
          // Budgets are per calendar month: other windows have none to draw.
          c.granularity === 'month'
            ? listBudgetsForMonth(range.start.slice(0, 7), hideAmounts)
                .then(budgetCover)
                .catch(() => null)
            : Promise.resolve(null),
        ]);
        if (seq !== loadSeq.current) return false;
        const thisMonth = toLocalIsoDate(new Date()).slice(0, 7);
        setComparison((prev) => keepIfEqual(prev, cmp));
        setLoadedKey(`${JSON.stringify(c)}|${hideAmounts}`);
        setTrend((prev) =>
          keepIfEqual(
            prev,
            tr.map((p, i) => ({
              ...p,
              totalMinor: cf[i]?.month === thisMonth ? cf[i].expenseMinor : p.totalMinor,
              recorded: cf[i]?.recorded,
              month: cf[i]?.month,
            }))
          )
        );
        // Net worth counts every account, savings included, so it goes while savings are hidden.
        setNetWorthTrend((prev) =>
          keepIfEqual(
            prev,
            hideAmounts && accs.some((a) => a.type === 'savings')
              ? []
              : nw.map((p, i) => ({
                  ...p,
                  month: cf[i]?.month,
                  recorded: !cf[i]?.month || cf[i].month! <= thisMonth,
                }))
          )
        );
        setCashFlow((prev) => keepIfEqual(prev, cf));
        const lastElapsed = cf.findLastIndex((p) => !p.month || p.month <= thisMonth);
        setCatTracks((prev) =>
          keepIfEqual(
            prev,
            ct.map((p) => ({ ...p, totalsMinor: p.totalsMinor.slice(0, lastElapsed + 1) }))
          )
        );
        setSavingsIds(savingsAccountIdsOf(accs));
        setDaily((prev) => keepIfEqual(prev, dy));
        setBudget((prev) => keepIfEqual(prev, bud));
        setCategories((prev) => keepIfEqual(prev, cats));
        setStartingBalanceNames((prev) =>
          keepIfEqual(prev, tidy ? tidy.map((g) => g.categoryName) : NO_NAMES)
        );
        setVersion((n) => n + 1);
        setStatus('ready');
        setErrorText(null);
        return true;
      } catch (e) {
        if (seq !== loadSeq.current) return false;
        setErrorText(errorMessage(e));
        setStatus('error');
        return false;
      }
    },
    [hideAmounts]
  );
  // Coming back with nothing written since this period loaded (same day): what's shown is current.
  const freshness = useFreshness();
  useLocalDayRefresh(() => {
    void load(cursor);
  });
  useFocusEffect(
    useCallback(() => {
      if (freshness.isFresh([load, cursor])) return;
      const started = freshness.start([load, cursor]);
      void load(cursor).then((ok) => {
        if (ok) freshness.commit(started);
      });
    }, [load, cursor, freshness])
  );
  useEffect(
    () => () => {
      ++loadSeq.current;
    },
    []
  );

  return {
    hideAmounts,
    comparison,
    savingsIds: useStableSet(savingsIds),
    trend,
    netWorthTrend,
    cashFlow,
    catTracks,
    daily,
    budget,
    categories,
    startingBalanceNames,
    status,
    errorText,
    /** The data belongs to the period being asked for, and there is a comparison to show. */
    ready: loadedKey === requestKey && comparison != null,
    version,
    load,
  };
}
