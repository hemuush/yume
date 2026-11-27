import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans, getLoanProgress } from '@/db/loans';
import { listBudgetsForMonth, type BudgetProgress } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { listCardCycles } from '@/db/cardCycles';
import { listExpectedRefunds, type ExpectedRefund } from '@/db/refundTracking';
import { listRecurringRules } from '@/db/recurring';
import {
  getPeriodSummary,
  getTodaySpend,
  getTodayEverydaySpend,
  getMonthPaceInputs,
  getStillToPayThisMonth,
  getCarryInMinor,
  getDailyExpenseTotals,
  type PeriodSummary,
} from '@/db/reports';
import { getUserName, getDailySpendingGoal, getDefaultCurrency } from '@/db/settings';
import { savingsAccountIdsOf } from '@/lib/account';
import { privateSummary, isSavingsEntry } from '@/lib/privateSummary';
import type { Account, Category, Transaction, Loan, RecurringRule, SavingsGoal } from '@/types';
import { CURRENT_PERIOD, periodRange, type PeriodCursor } from '@/lib/period';
import { toLocalIsoDate } from '@/lib/date';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { useFreshness } from '@/hooks/useFreshness';
import { useLocalDayRefresh } from '@/hooks/useLocalDayRefresh';
import { runWhenIdle } from '@/lib/runWhenIdle';
import { errorMessage } from '@/lib/errorMessage';
import { keepIfEqual, reuseUnchanged } from '@/lib/stableData';
import { usePrivacy } from '@/theme/PrivacyContext';
import { loadReadyWraps, type ReadyWrap } from '@/features/wrap/wrapWindow';
import { loadNeedsYou } from './needsYouData';
import { spendBarsStart } from './spendBarData';

/** Home shows this many of the period's latest entries; fetch no more than that. */
const RECENT_ROWS = 5;

const NO_DAILY: { date: string; totalMinor: number }[] = [];

/**
 * What Home shows of the ledger, and keeping it current: everything the page reads, loaded for the period the cursor
 * is on, reloaded in place when an entry is saved elsewhere, when the day turns, and when Home is next shown after a
 * write. Whatever a reload did not change stays the very same object (`keepIfEqual`, `reuseUnchanged`), so the
 * sections of the page, which compare by identity, redraw only for what really moved.
 */
export function useHomeData(cursor: PeriodCursor) {
  const { hideAmounts } = usePrivacy();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [historyAccounts, setHistoryAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  // This month's budgets and the open goals, for Coming up (they stay in place while a month is browsed).
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [rawSummary, setSummary] = useState<PeriodSummary | null>(null);
  // What earlier months left over (or, when negative, ran short by) — added to the period's own free-to-use.
  const [carryInMinor, setCarryInMinor] = useState(0);
  const summary = useMemo(
    () => rawSummary && privateSummary(rawSummary, hideAmounts),
    [rawSummary, hideAmounts]
  );
  const [loanProgress, setLoanProgress] = useState<Awaited<ReturnType<typeof getLoanProgress>>>([]);
  const [cardBills, setCardBills] = useState<Awaited<ReturnType<typeof listCardCycles>>>([]);
  // The default currency: Home's in-hand total counts only accounts in it.
  const [currency, setCurrency] = useState('INR');
  const [refunds, setRefunds] = useState<ExpectedRefund[]>([]);
  const [refundError, setRefundError] = useState(false);
  const [dailySpend, setDailySpend] = useState<{ date: string; totalMinor: number }[]>(NO_DAILY);
  // Both are always about today, not the browsed period (like Budgets/Goals above); `dailyGoal` stays
  // `null` (strip renders nothing) until the user sets one in Settings → Money.
  const [todaySpendMinor, setTodaySpendMinor] = useState(0);
  const [todayEverydayMinor, setTodayEverydayMinor] = useState(0);
  const [dailyGoalMinor, setDailyGoalMinor] = useState<number | null>(null);
  // Inputs to the month forecast under the moon (see lib/pace.ts).
  const [paceInputs, setPaceInputs] = useState<{
    everydaySpentMinor: number;
    dueRestOfMonthMinor: number;
  } | null>(null);
  // Unpaid EMIs and bills left this month, for the card's "Left after bills".
  const [stillToPayMinor, setStillToPayMinor] = useState(0);
  // How many things need you (see needsYou.ts): the bell shows the count and opens the list. Only the count is held,
  // so a refresh that found the same number redraws nothing.
  const [needsYouCount, setNeedsYouCount] = useState(0);
  // Last week's Wrap on a Monday, last month's on the 1st–7th: the header's Wrap button (wrapWindow.ts).
  const [readyWraps, setReadyWraps] = useState<ReadyWrap[]>([]);
  const [userName, setUserNameState] = useState<string | null>(null);
  // The period the on-screen figures belong to: `cursor` moves at once, this catches up once that month's data loads.
  const [loadedCursor, setLoadedCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comingUpError, setComingUpError] = useState(false);
  const [loadedPrivacy, setLoadedPrivacy] = useState<boolean | null>(null);
  const [periodPrivacy, setPeriodPrivacy] = useState<boolean | null>(null);
  const [comingUpPrivacy, setComingUpPrivacy] = useState<boolean | null>(null);
  const lastComingUpPrivacy = useRef<boolean | null>(null);
  // Defaults ([], 0, null) look like a genuinely empty period, so the skeleton gates on this flag: set once
  // after the first `load()` (success or failure), never reset; later fetches update in place.
  const [loaded, setLoaded] = useState(false);

  // Quick period stepping starts overlapping loads that can finish out of order; only the latest may write
  // state, or last month's data lands under this month's label (periodSeq/fullSeq).
  const periodSeq = useRef(0);
  const fullSeq = useRef(0);
  // The cursor the latest period fetch was started for, so the effect below
  // only fires for a real change and never doubles up a full load.
  const fetchedCursor = useRef<PeriodCursor>(CURRENT_PERIOD);
  const cursorRef = useRef(cursor);
  useEffect(() => {
    cursorRef.current = cursor;
  });

  // Period figures and today's remaining amount commit together, so a month refresh cannot leave the daily strip stale.
  const fetchPeriod = useCallback(
    (c: PeriodCursor) => {
      const reference = new Date();
      const today = toLocalIsoDate(reference);
      const range = periodRange(c, reference);
      const daily =
        c.granularity === 'month'
          ? getDailyExpenseTotals(
              {
                start: c.offset === 0 ? spendBarsStart(today) : range.start,
                end: c.offset === 0 ? today : range.end,
              },
              hideAmounts,
              undefined,
              'outgoing'
            )
          : Promise.resolve([]);
      return Promise.all([
        listTransactions({ fromDate: range.start, toDate: range.end, limit: RECENT_ROWS }),
        getPeriodSummary(range),
        getCarryInMinor(range.start, hideAmounts),
        daily,
        c.offset !== 0
          ? Promise.resolve(0)
          : c.granularity === 'month'
            ? daily.then((rows) => rows.find((row) => row.date === today)?.totalMinor ?? 0)
            : getTodaySpend(today, hideAmounts),
        c.offset !== 0 ? Promise.resolve(0) : getTodayEverydaySpend(today, hideAmounts),
      ]);
    },
    [hideAmounts]
  );

  // The period's own figures, as one update.
  const landPeriod = useCallback(
    (
      c: PeriodCursor,
      [tx, period, carry, daily, todaySpend, todayEveryday]: Awaited<ReturnType<typeof fetchPeriod>>
    ) => {
      setDailySpend((prev) => keepIfEqual(prev, daily));
      setTodaySpendMinor(todaySpend);
      setTodayEverydayMinor(todayEveryday);
      setRecent((prev) => reuseUnchanged(prev, tx));
      setSummary((prev) => keepIfEqual(prev, period));
      setCarryInMinor(carry);
      setLoadedCursor((prev) => keepIfEqual(prev, c));
      setPeriodPrivacy(hideAmounts);
    },
    [hideAmounts]
  );

  // Accounts, loans and settings stay in place while the selected period reloads.
  const loadPeriod = useCallback(
    async (c: PeriodCursor) => {
      fetchedCursor.current = c;
      const seq = ++periodSeq.current;
      try {
        const period = await fetchPeriod(c);
        if (seq !== periodSeq.current) return;
        landPeriod(c, period);
        setLoadError(null);
        setLoaded(true);
      } catch (e) {
        if (seq === periodSeq.current) setLoadError(errorMessage(e));
      }
    },
    [fetchPeriod, landPeriod]
  );

  const load = useCallback(
    async (c: PeriodCursor) => {
      fetchedCursor.current = c;
      const pSeq = ++periodSeq.current;
      const fSeq = ++fullSeq.current;
      let periodWritten = false;
      let failed = false;
      try {
        const [
          period,
          accs,
          cats,
          ln,
          rules,
          progress,
          name,
          dailyGoal,
          paceIn,
          stillToPay,
          wraps,
          defaultCurrency,
        ] = await Promise.all([
          fetchPeriod(c),
          listAccounts(true),
          listCategories(true),
          listLoans(),
          listRecurringRules(),
          getLoanProgress(),
          getUserName(),
          getDailySpendingGoal(),
          getMonthPaceInputs(undefined, hideAmounts),
          getStillToPayThisMonth(undefined, hideAmounts),
          loadReadyWraps(),
          getDefaultCurrency(),
        ]);
        if (pSeq === periodSeq.current) {
          landPeriod(c, period);
          periodWritten = true;
        }
        if (fSeq !== fullSeq.current) return false;
        setHistoryAccounts((prev) => keepIfEqual(prev, accs));
        setAccounts((prev) =>
          keepIfEqual(
            prev,
            accs.filter((account) => !account.archived)
          )
        );
        setCategories((prev) => keepIfEqual(prev, cats));
        // A defaulted loan is still real money owed (or owed to you) — only a
        // 'closed' loan (fully paid off) should ever drop out of these totals.
        setLoans((prev) =>
          keepIfEqual(
            prev,
            ln.filter((l) => l.status !== 'closed')
          )
        );
        if (hideAmounts) {
          const catById = new Map(cats.map((cat) => [cat.id, cat]));
          const savingsIds = savingsAccountIdsOf(accs);
          setRecurringRules((prev) =>
            keepIfEqual(
              prev,
              rules.filter((r) => !isSavingsEntry(r, catById, savingsIds))
            )
          );
        } else {
          setRecurringRules((prev) => keepIfEqual(prev, rules));
        }
        setLoanProgress((prev) => keepIfEqual(prev, progress));
        setUserNameState(name);
        setDailyGoalMinor(dailyGoal);
        setPaceInputs((prev) => keepIfEqual(prev, paceIn));
        setStillToPayMinor(stillToPay);
        setReadyWraps((prev) => keepIfEqual(prev, wraps));
        setCurrency(defaultCurrency);
        setLoadedPrivacy(hideAmounts);
        if (periodWritten) setLoaded(true);
        setLoadError(null);

        // Give the balance and recent activity a chance to render before queueing optional reads.
        const [cycles, budgetRows, goalRows, refundRows] = await Promise.all([
          listCardCycles().catch(() => null),
          listBudgetsForMonth(undefined, hideAmounts).catch(() => null),
          listSavingsGoals().catch(() => null),
          listExpectedRefunds().catch(() => null),
        ]);
        if (fSeq !== fullSeq.current) return false;
        const samePrivacy = lastComingUpPrivacy.current === hideAmounts;
        lastComingUpPrivacy.current = hideAmounts;
        setCardBills((prev) => (cycles === null ? (samePrivacy ? prev : []) : keepIfEqual(prev, cycles)));
        setBudgets((prev) =>
          budgetRows === null ? (samePrivacy ? prev : []) : keepIfEqual(prev, budgetRows)
        );
        setGoals((prev) => (goalRows === null ? (samePrivacy ? prev : []) : keepIfEqual(prev, goalRows)));
        setComingUpError(cycles === null || budgetRows === null || goalRows === null);
        setRefunds((prev) =>
          refundRows === null ? (samePrivacy ? prev : []) : keepIfEqual(prev, refundRows)
        );
        setRefundError(refundRows === null);
        setComingUpPrivacy(hideAmounts);
        // Housekeeping scans do not gate the first useful financial content or the tab transition.
        runWhenIdle(() => {
          if (fSeq !== fullSeq.current) return;
          void loadNeedsYou()
            .then((needs) => {
              if (fSeq === fullSeq.current) setNeedsYouCount(needs.shown.length);
            })
            .catch((error) => console.warn('Needs you refresh failed:', error));
        });
      } catch (e) {
        if (fSeq !== fullSeq.current) return false;
        // Guard the throw so a transient DB error shows a banner instead of
        // freezing stale data + a stuck pull-to-refresh spinner.
        failed = true;
        setLoadError(errorMessage(e));
      } finally {
        // Not "loaded" until a period's figures have landed, so the card never
        // shows an empty month for a moment — a newer period fetch sets it too.
        if (fSeq === fullSeq.current && (periodWritten || failed)) setLoaded(true);
      }
      return !failed && fSeq === fullSeq.current;
    },
    [hideAmounts, fetchPeriod, landPeriod]
  );
  // For what reloads Home in place for whatever period is showing now.
  const reload = useCallback(() => load(cursorRef.current), [load]);

  // Coming back to Home with nothing changed (no write, same day, same settings) shows what's already here
  // instead of re-running every query.
  const freshness = useFreshness();
  useLocalDayRefresh(() => {
    void load(cursorRef.current);
  }, true);
  // Whether Home is on screen: a save made elsewhere is picked up when Home is next focused (the write marks
  // it stale), so the change event only reloads in place while Home is showing.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, [])
  );
  useFocusEffect(
    useCallback(() => {
      if (freshness.isFresh([load])) return;
      const started = freshness.start([load]);
      void load(cursorRef.current).then((ok) => {
        if (ok) freshness.commit(started);
      });
    }, [load, freshness])
  );
  // A save that doesn't leave Home (the + long-press sheet) — reload in place.
  useEffect(
    () =>
      onTransactionsChanged(() => {
        if (focused.current) void load(cursorRef.current);
      }),
    [load]
  );
  // A new month or year: just that period's figures.
  useEffect(() => {
    if (fetchedCursor.current !== cursor) void loadPeriod(cursor);
  }, [cursor, loadPeriod]);

  return {
    accounts,
    historyAccounts,
    categories,
    recent,
    loans,
    budgets,
    goals,
    recurringRules,
    summary,
    carryInMinor,
    loanProgress,
    cardBills,
    currency,
    refunds,
    refundError,
    dailySpend,
    todaySpendMinor,
    todayEverydayMinor,
    dailyGoalMinor,
    paceInputs,
    stillToPayMinor,
    needsYouCount,
    readyWraps,
    userName,
    loadedCursor,
    loadError,
    loaded: loaded && loadedPrivacy === hideAmounts && periodPrivacy === hideAmounts,
    comingUpError,
    comingUpReady: comingUpPrivacy === hideAmounts,
    hideAmounts,
    load,
    reload,
  };
}
