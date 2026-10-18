import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans, getLoanProgress } from '@/db/loans';
import { listCardCycles } from '@/db/cardCycles';
import { listExpectedRefunds, ExpectedRefund } from '@/db/refundTracking';
import { getTransactionById } from '@/db/transactions';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { showAlert } from '@/components/AppDialog';
import { listRecurringRules } from '@/db/recurring';
import {
  getRangeComparison,
  PeriodComparison,
  findTopGrowingCategory,
  getTodaySpend,
  getMonthPaceInputs,
  getStillToPayThisMonth,
  getCarryInMinor,
  getDailyExpenseTotals,
} from '@/db/reports';
import { monthPace } from '@/lib/pace';
import { getUserName, getDailySpendingGoal, getDefaultCurrency } from '@/db/settings';
import { listBudgetsForMonth, BudgetProgress } from '@/db/budgets';
import { savingsAccountIdsOf } from '@/lib/account';
import { privateComparison, isSavingsEntry } from '@/lib/privateSummary';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct } from '@/lib/savingsRate';
import { Account, Category, Transaction, Loan, RecurringRule, SavingsGoal } from '@/types';
import { listSavingsGoals } from '@/db/savingsGoals';
import { theme } from '@/constants/theme';
import { useTabScrollPad } from '@/lib/uiScale';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { EmptyState } from '@/components/EmptyState';
import {
  CURRENT_PERIOD,
  PeriodCursor,
  periodRange,
  previousPeriodRange,
  stepPeriod,
  canStepForward,
} from '@/lib/period';
import {
  homeRowEntering,
  homeSectionEntering,
  hasPlayedHomeOpening,
  markHomeOpeningPlayed,
  ROW_LAYOUT,
  ROW_EXIT,
} from '@/lib/animation';
import { HomeHeader } from '@/features/home/HomeHeader';
import { ThisMonthHero } from '@/features/home/ThisMonthHero';
import { ThisMonthHeroSkeleton, CardRowsSkeleton } from '@/features/home/HomeSkeleton';
import { MonthPill } from '@/features/home/MonthPill';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { WhereItWent } from '@/features/home/WhereItWent';
import { HomeAccounts } from '@/features/home/HomeAccounts';
import { SpendBars } from '@/features/home/SpendBars';
import { spendBarsStart } from '@/features/home/spendBarData';
import { Glass } from '@/components/Glass';
import { SuuRefreshBadge } from '@/features/home/SuuRefreshBadge';
import { Section } from '@/components/Section';
import { SCREEN } from '@/components/screenStyles';
import { HomeGlance, buildUpcomingItems } from '@/features/home/HomeGlance';
import { buildLoansSummary } from '@/features/plan/planOverview';
import { RecentTransactionRow } from '@/features/home/RecentTransactionRow';
import { AccountSummarySheet } from '@/features/home/AccountSummarySheet';
import { AccountDetailModal } from '@/features/profile/AccountDetailModal';
import { suuLine } from '@/features/home/suuLine';
import { loadReadyWraps, ReadyWrap } from '@/features/wrap/wrapWindow';
import { NeedsYouItem } from '@/features/home/needsYou';
import { loadNeedsYou } from '@/features/home/needsYouData';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { toLocalIsoDate } from '@/lib/date';
import { categorySentence } from '@/lib/categoryLabel';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { useFreshness } from '@/lib/useFreshness';
import { errorMessage } from '@/lib/errorMessage';
import { payCardRoute } from '@/lib/payCard';

/** Home shows this many of the period's latest entries; fetch no more than that. */
const RECENT_ROWS = 3;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const { hideAmounts } = usePrivacy();
  const { accent, secondary } = useAccent();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [historyAccounts, setHistoryAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [rawComparison, setComparison] = useState<PeriodComparison | null>(null);
  // What earlier months left over (or, when negative, ran short by) — added to the period's own free-to-use.
  const [carryInMinor, setCarryInMinor] = useState(0);
  const comparison = useMemo(
    () => privateComparison(rawComparison, hideAmounts),
    [rawComparison, hideAmounts]
  );
  const [loanProgress, setLoanProgress] = useState<Awaited<ReturnType<typeof getLoanProgress>>>([]);
  const [cardBills, setCardBills] = useState<Awaited<ReturnType<typeof listCardCycles>>>([]);
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  // Spending per day, from a week back (or the 1st) to today: the Week/Month bars.
  // The default currency: Home's in-hand total counts only accounts in it.
  const [currency, setCurrency] = useState('INR');
  const [refunds, setRefunds] = useState<ExpectedRefund[]>([]);
  const [refundError, setRefundError] = useState(false);
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);
  const [openingRefund, setOpeningRefund] = useState<string | null>(null);
  const refundRequest = useRef(0);
  const openingRefundRef = useRef(false);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [dailySpend, setDailySpend] = useState<{ date: string; totalMinor: number }[]>([]);
  // Both are always about today, not the browsed period (like Budgets/Goals below); `dailyGoal` stays
  // `null` (strip renders nothing) until the user sets one in Settings → Money.
  const [todaySpendMinor, setTodaySpendMinor] = useState(0);
  const [dailyGoalMinor, setDailyGoalMinor] = useState<number | null>(null);
  // Inputs to the month forecast under the moon (see lib/pace.ts).
  const [paceInputs, setPaceInputs] = useState<{
    everydaySpentMinor: number;
    dueRestOfMonthMinor: number;
  } | null>(null);
  // Unpaid EMIs and bills left this month, for the card's "Free after bills".
  const [stillToPayMinor, setStillToPayMinor] = useState(0);
  // Everything that needs you (see features/home/needsYou.ts). The bell opens
  // the list and shows the count; Home itself only flags the Budgets tab.
  const [needsYou, setNeedsYou] = useState<NeedsYouItem[]>([]);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  // Tapping an account card opens its summary; "Edit account" there swaps
  // it for the full edit form.
  const [summaryAccount, setSummaryAccount] = useState<Account | null>(null);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  // Last week's Wrap on a Monday, last month's on the 1st–7th: the header's Wrap button (wrapWindow.ts).
  const [readyWraps, setReadyWraps] = useState<ReadyWrap[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserNameState] = useState<string | null>(null);
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  // The period the on-screen figures belong to: `cursor` moves at once, this catches up once that month's
  // data loads. The hero turns its page on it, so a new month name never shows the old month's numbers.
  const [loadedCursor, setLoadedCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [displayedPeriodKey, setDisplayedPeriodKey] = useState('month:0');
  const displayedCursor = useMemo<PeriodCursor>(() => {
    const [kind, offset] = displayedPeriodKey.split(':');
    return { granularity: kind === 'year' ? 'year' : 'month', offset: Number(offset) };
  }, [displayedPeriodKey]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Defaults ([], 0, null) look like a genuinely empty period, so the skeleton gates on this flag: set once
  // after the first `load()` (success or failure), never reset; later fetches update in place.
  const [loaded, setLoaded] = useState(false);
  // The staggered opening fade plays only on the first load after app open; later rows (new month, refresh)
  // get one quick fade. Flipped shortly after the first load, once the opening rows have mounted.
  const [openingDone, setOpeningDone] = useState(hasPlayedHomeOpening);
  useEffect(() => {
    if (!loaded || openingDone) return;
    const t = setTimeout(() => {
      markHomeOpeningPlayed();
      setOpeningDone(true);
    }, 800);
    return () => clearTimeout(t);
  }, [loaded, openingDone]);
  const rowEntering = (i: number) => homeRowEntering(i, !openingDone);
  const sectionEntering = (i: number) => homeSectionEntering(i, !openingDone);
  // Hero slide direction on month change: +1/-1 for a same-granularity step, else 0 (crossfade). State, not
  // a ref (ThisMonthHero reads it in render); set with `setCursor` so one re-render carries both.
  const [heroDirection, setHeroDirection] = useState<-1 | 0 | 1>(0);

  // The header overlays the ScrollView and collapses on scroll (see HomeHeader); its expanded height pads
  // the content so nothing hides under it. The estimate only covers the first frame before it measures.
  const scrollY = useSharedValue(0);
  // Tapping the logo scrolls Home back to the top.
  const scrollRef = useRef<Animated.ScrollView>(null);
  const reduceMotion = useReduceMotion();
  // Also re-read the offset where the list stops: a throttled last scroll event can miss it, which would leave the
  // header a little collapsed with the list at its top (see useCollapsingHeader).
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onEndDrag: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onMomentumEnd: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const [headerHeight, setHeaderHeight] = useState(insets.top + 200);

  const handleCursorChange = useCallback(
    (next: PeriodCursor) => {
      setHeroDirection(
        next.granularity !== cursor.granularity
          ? 0
          : next.offset > cursor.offset
            ? 1
            : next.offset < cursor.offset
              ? -1
              : 0
      );
      setCursor(next);
    },
    [cursor]
  );

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

  // The three things that change with the period: its entries, its totals
  // against the one before, and what carried over into it.
  const fetchPeriod = useCallback(
    (c: PeriodCursor) => {
      const range = periodRange(c);
      return Promise.all([
        // Scoped to the navigator's period; unscoped most-recent rows contradicted the selected month/year.
        listTransactions({ fromDate: range.start, toDate: range.end, limit: RECENT_ROWS }),
        getRangeComparison(range, previousPeriodRange(c), c.granularity),
        getCarryInMinor(range.start, hideAmounts),
      ]);
    },
    [hideAmounts]
  );

  // Stepping to another month only needs those three — accounts, loans,
  // budgets, bills and the rest don't depend on it, so they stay as they are.
  const loadPeriod = useCallback(
    async (c: PeriodCursor) => {
      fetchedCursor.current = c;
      const seq = ++periodSeq.current;
      try {
        const [tx, cmp, carry] = await fetchPeriod(c);
        if (seq !== periodSeq.current) return;
        setRecent(tx);
        setComparison(cmp);
        setCarryInMinor(carry);
        setLoadedCursor(c);
        setLoadError(null);
        setLoaded(true);
      } catch (e) {
        if (seq === periodSeq.current) setLoadError(errorMessage(e));
      }
    },
    [fetchPeriod]
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
          cycles,
          name,
          budgetList,
          goalList,
          daily,
          todaySpend,
          dailyGoal,
          paceIn,
          stillToPay,
          needs,
          wraps,
          defaultCurrency,
          refundResult,
        ] = await Promise.all([
          fetchPeriod(c),
          listAccounts(true),
          listCategories(true),
          listLoans(),
          listRecurringRules(),
          getLoanProgress(),
          listCardCycles().catch(() => []),
          getUserName(),
          // Budgets, goals, today's spend and the daily goal are always about *now*, not the browsed period
          // (a budget is this calendar month; a goal has no period).
          listBudgetsForMonth(undefined, hideAmounts),
          listSavingsGoals(),
          getDailyExpenseTotals(
            { start: spendBarsStart(toLocalIsoDate(new Date())), end: toLocalIsoDate(new Date()) },
            hideAmounts
          ),
          getTodaySpend(undefined, hideAmounts),
          getDailySpendingGoal(),
          getMonthPaceInputs(undefined, hideAmounts),
          getStillToPayThisMonth(undefined, hideAmounts),
          loadNeedsYou(),
          loadReadyWraps(),
          getDefaultCurrency(),
          listExpectedRefunds()
            .then((rows) => ({ rows, failed: false }))
            .catch(() => ({ rows: [] as ExpectedRefund[], failed: true })),
        ]);
        if (pSeq === periodSeq.current) {
          const [tx, cmp, carry] = period;
          setRecent(tx);
          setComparison(cmp);
          setCarryInMinor(carry);
          setLoadedCursor(c);
          periodWritten = true;
        }
        if (fSeq !== fullSeq.current) return false;
        setHistoryAccounts(accs);
        setAccounts(accs.filter((account) => !account.archived));
        setCategories(cats);
        // A defaulted loan is still real money owed (or owed to you) — only a
        // 'closed' loan (fully paid off) should ever drop out of these totals.
        setLoans(ln.filter((l) => l.status !== 'closed'));
        if (hideAmounts) {
          const catById = new Map(cats.map((cat) => [cat.id, cat]));
          const savingsIds = savingsAccountIdsOf(accs);
          setRecurringRules(rules.filter((r) => !isSavingsEntry(r, catById, savingsIds)));
        } else {
          setRecurringRules(rules);
        }
        setLoanProgress(progress);
        setCardBills(cycles);
        setUserNameState(name);
        setBudgets(budgetList);
        setGoals(goalList);
        setRefunds(refundResult.rows);
        setRefundError(refundResult.failed);
        setDailySpend(daily);
        setTodaySpendMinor(todaySpend);
        setDailyGoalMinor(dailyGoal);
        setPaceInputs(paceIn);
        setStillToPayMinor(stillToPay);
        setNeedsYou(needs.shown);
        setReadyWraps(wraps);
        setCurrency(defaultCurrency);
        setLoadError(null);
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
    [hideAmounts, fetchPeriod]
  );

  // Coming back to Home with nothing changed (no write, same day, same settings) shows what's already here
  // instead of re-running every query.
  const freshness = useFreshness();
  // Whether Home is on screen: a save made elsewhere is picked up when Home is next focused (the write marks
  // it stale), so the change event only reloads in place while Home is showing.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        refundRequest.current++;
        openingRefundRef.current = false;
        setOpeningRefund(null);
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

  const openRefund = async (transactionId: string) => {
    if (openingRefundRef.current) return;
    openingRefundRef.current = true;
    const ticket = ++refundRequest.current;
    setOpeningRefund(transactionId);
    try {
      const tx = await getTransactionById(transactionId);
      if (ticket !== refundRequest.current) return;
      if (!tx) {
        showAlert('Purchase unavailable', 'This purchase may have been deleted. Refresh Home and try again.');
        return;
      }
      setSummaryAccount(null);
      setRefundTx(tx);
    } catch (e) {
      if (ticket === refundRequest.current) showAlert('Couldn’t open the refund', errorMessage(e));
    } finally {
      if (ticket === refundRequest.current) {
        openingRefundRef.current = false;
        setOpeningRefund(null);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(cursor);
    setRefreshing(false);
  };

  // Looked up per row on every render, so by id rather than a scan of the whole list each time.
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(historyAccounts.map((a) => [a.id, a])), [historyAccounts]);
  const categoryFor = (id: string | null) => (id ? categoriesById.get(id) : undefined);
  const parentNameFor = (id: string | null) => {
    const parentId = categoryFor(id)?.parentId;
    return parentId ? categoryFor(parentId)?.name : undefined;
  };
  const accountName = (id: string | null | undefined) => (id ? accountsById.get(id)?.name : undefined);
  const savingsIds = savingsAccountIdsOf(historyAccounts);
  const isSavingsTransfer = (tx: Transaction) =>
    tx.type === 'transfer' &&
    (savingsIds.has(tx.accountId) || (!!tx.toAccountId && savingsIds.has(tx.toAccountId)));

  const totalOutstandingLoans = loans
    .filter((l) => l.direction === 'borrowed')
    .reduce((sum, l) => sum + l.outstandingPrincipalMinor, 0);

  const dispIncome = roundedMinor(comparison?.current.incomeMinor ?? 0);
  const dispExpense = roundedMinor(comparison?.current.expenseMinor ?? 0);
  // Where this month is heading — the current month only, and only once
  // there's enough of it to go on (monthPace returns null before the 5th).
  const todayIso = toLocalIsoDate(new Date());
  const paceMinor =
    paceInputs && comparison && loadedCursor.granularity === 'month' && loadedCursor.offset === 0
      ? monthPace({ spentMinor: comparison.current.expenseMinor, ...paceInputs, today: todayIso })
      : null;
  const monthEndLabel = (() => {
    const [y, m] = todayIso.split('-').map(Number);
    return new Date(y, m, 0).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  })();
  const savingsInPeriod = roundedMinor(comparison?.current.savingsContributionMinor ?? 0);
  // Income − expense − whatever was already moved into savings this period.
  const carryIn = roundedMinor(carryInMinor);
  // What's free to use: what earlier months left over, plus this period's own surplus.
  const surplusInPeriod = carryIn + dispIncome - dispExpense - savingsInPeriod;

  const expenseChangePct = comparison?.expenseChangePct;

  const topGrowing =
    comparison &&
    findTopGrowingCategory(comparison.current.categoryBreakdown, comparison.previous.categoryBreakdown);

  // "Saved" = income not spent (in any account), so savers who sweep cash into a pot don't read 0%. The
  // spend-up nudge is folded into Suu's line (see suuLine's comment for why it takes priority).
  const savingsPct = savingsRatePct(dispIncome - dispExpense, dispIncome);
  // Memoised: the line is picked at random, so recomputing it every render would reshuffle it on each re-render.
  const topGrowingName = topGrowing?.name ?? null;
  const changePct = expenseChangePct ?? null;
  const hour = new Date().getHours();
  const suu = useMemo(
    () => suuLine(savingsPct, changePct, topGrowingName, hour, hideAmounts),
    [savingsPct, changePct, topGrowingName, hour, hideAmounts]
  );

  // Rebuilt only when its inputs change, not on every swipe or scroll-driven render.
  const upcoming = useMemo(() => {
    const cat = (id: string | null) => (id ? categoriesById.get(id) : undefined);
    return buildUpcomingItems({
      loans: buildLoansSummary(loans, loanProgress).rows.flatMap((row) =>
        row.direction === 'borrowed' && row.nextDueDate && row.nextEmiMinor != null
          ? [{ id: row.id, name: row.name, nextDueDate: row.nextDueDate, nextEmiMinor: row.nextEmiMinor }]
          : []
      ),
      cardBills,
      rules: recurringRules,
      accent,
      secondary,
      accountName: (id) => (id ? accountsById.get(id)?.name : undefined),
      categoryName: (id) => {
        const c = cat(id);
        const parentId = c?.parentId;
        return c && categorySentence(c.name, parentId ? cat(parentId)?.name : undefined);
      },
      categoryColor: (id) => cat(id)?.color,
    });
  }, [loans, loanProgress, cardBills, recurringRules, accent, secondary, categoriesById, accountsById]);

  const openSpendingReports = () => {
    const range = periodRange(loadedCursor);
    router.navigate({
      pathname: '/reports',
      params:
        loadedCursor.granularity === 'month'
          ? { month: String(loadedCursor.offset) }
          : { from: range.start, to: range.end },
    });
  };

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      {/* Top to bottom, the "arranged Home" sign-off: the header (with the
          quick actions in it), your month, what needs you, your plans, then
          history — recent activity and accounts. */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: tabScrollPad + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
            colors={[accent]}
            // Android draws the spinner at the ScrollView's top edge, which is
            // under the header — start it below the header instead.
            progressViewOffset={headerHeight}
          />
        }
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <View style={styles.heroGap}>
          {loaded ? (
            <Animated.View entering={sectionEntering(0)}>
              <ThisMonthHero
                periodKey={`${loadedCursor.granularity}:${loadedCursor.offset}`}
                direction={heroDirection}
                renderPeriod={(key) => {
                  const [kind, offset] = key.split(':');
                  return (
                    <MonthPill
                      cursor={{ granularity: kind === 'year' ? 'year' : 'month', offset: Number(offset) }}
                      onChange={handleCursorChange}
                    />
                  );
                }}
                onPeriodDisplayed={setDisplayedPeriodKey}
                canStepForward={canStepForward(cursor)}
                onStep={(dir) => handleCursorChange(stepPeriod(cursor, dir))}
                incomeMinor={dispIncome}
                spentMinor={dispExpense}
                savingsMinor={savingsInPeriod}
                surplusMinor={surplusInPeriod}
                carryMinor={carryIn}
                outstandingLoansMinor={roundedMinor(totalOutstandingLoans)}
                dueMinor={
                  loadedCursor.granularity === 'month' && loadedCursor.offset === 0
                    ? roundedMinor(stillToPayMinor)
                    : 0
                }
                // Today is always about today — only alongside the current period.
                today={
                  dailyGoalMinor != null && loadedCursor.offset === 0
                    ? { spentMinor: todaySpendMinor, goalMinor: dailyGoalMinor }
                    : null
                }
                pace={paceMinor != null ? { projectedMinor: paceMinor, byLabel: monthEndLabel } : null}
              />
            </Animated.View>
          ) : (
            <ThisMonthHeroSkeleton />
          )}
        </View>

        {!loaded && (
          <>
            <View style={{ marginTop: SCREEN.sectionGap }}>
              <CardRowsSkeleton rows={2} meter />
            </View>
            <Section title="Recent activity">
              <CardRowsSkeleton rows={3} subtitle />
            </Section>
          </>
        )}

        {/* What needs you first (upcoming bills, budgets near their limit, goals), then spending, then history. */}
        {loaded && (
          <Animated.View entering={sectionEntering(1)}>
            <HomeGlance
              upcoming={upcoming}
              budgets={budgets}
              goals={goals}
              refunds={refunds}
              refundError={refundError}
              openingRefund={openingRefund}
              onOpenRefund={(id) => void openRefund(id)}
              onRetryRefunds={() => void load(cursorRef.current)}
              budgetAlert={needsYou.some((i) => i.action === 'budgets')}
              rowEntering={rowEntering}
              onSeeMoreUpcoming={() => router.navigate({ pathname: '/plan', params: { tab: 'upcoming' } })}
            />
          </Animated.View>
        )}

        {loaded && comparison && (
          <Animated.View entering={sectionEntering(2)}>
            <Section title="Spending" onSeeAll={openSpendingReports}>
              <WhereItWent
                // A new period starts on its own biggest category, not whichever place was picked before.
                key={`${loadedCursor.granularity}:${loadedCursor.offset}`}
                breakdown={comparison.current.categoryBreakdown}
                iconFor={(id) => categoriesById.get(id)?.icon}
                spentMinor={dispExpense}
                onOpenReports={openSpendingReports}
                onOpenCategory={(id) =>
                  router.push({
                    pathname: '/category/[id]',
                    params: { id, g: loadedCursor.granularity, o: String(loadedCursor.offset) },
                  })
                }
                onAddExpense={() => router.push('/add-transaction?type=expense')}
                // The bars are always about now (the last 7 days, this month), so only beside the current month.
                footer={
                  dailySpend.length > 0 &&
                  loadedCursor.granularity === 'month' &&
                  loadedCursor.offset === 0 ? (
                    <SpendBars daily={dailySpend} today={todayIso} />
                  ) : undefined
                }
              />
            </Section>
          </Animated.View>
        )}

        {loaded && (
          <Animated.View entering={sectionEntering(3)}>
            <Section title="Recent activity" onSeeAll={() => router.push('/transactions')}>
              {recent.length === 0 ? (
                <EmptyState title="Nothing logged" subtitle="Try another period." />
              ) : (
                <Glass radius={24} style={styles.recent}>
                  {recent.map((tx, i) => (
                    <Animated.View
                      key={tx.id}
                      entering={rowEntering(i)}
                      layout={ROW_LAYOUT}
                      exiting={ROW_EXIT}
                    >
                      <RecentTransactionRow
                        currency={accountsById.get(tx.accountId)?.currency}
                        tx={tx}
                        category={categoryFor(tx.categoryId) ?? undefined}
                        parentName={parentNameFor(tx.categoryId)}
                        accountName={accountName(tx.accountId)}
                        toAccountName={accountName(tx.toAccountId)}
                        savingsTransfer={isSavingsTransfer(tx)}
                        divider={i > 0}
                      />
                    </Animated.View>
                  ))}
                </Glass>
              )}
            </Section>
          </Animated.View>
        )}

        {/* Accounts last: the money you hold, one tap from the full list. */}
        {loaded && (
          <Animated.View entering={sectionEntering(4)} style={styles.bento}>
            <HomeAccounts
              accounts={accounts}
              currency={currency}
              onOpenAccounts={() => router.push('/profile')}
              onOpenAccount={setSummaryAccount}
              onAddAccount={() => setAddAccountVisible(true)}
            />
          </Animated.View>
        )}
      </Animated.ScrollView>

      <HomeHeader
        cursor={displayedCursor}
        onChange={handleCursorChange}
        userName={userName}
        alertCount={needsYou.length}
        scrollY={scrollY}
        onHeight={setHeaderHeight}
        wraps={readyWraps}
        onPlayWrap={(w) => router.push(`/wrap?period=${w.period}`)}
        line={suu.text}
        onBrandPress={() => scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion })}
      />
      <SuuRefreshBadge refreshing={refreshing} />

      <AccountSummarySheet
        account={summaryAccount}
        cursor={cursor}
        accounts={accounts}
        categories={categories}
        onClose={() => setSummaryAccount(null)}
        onAdd={(acc) => {
          setSummaryAccount(null);
          router.push(
            `/add-transaction?type=${acc.type === 'savings' ? 'transfer' : 'expense'}&accountId=${acc.id}`
          );
        }}
        onEdit={(acc) => {
          setSummaryAccount(null);
          setEditAccount(acc);
        }}
        onChanged={() => load(cursor)}
        onPayBill={(acc, amountMinor) => {
          setSummaryAccount(null);
          router.push(payCardRoute(acc.id, amountMinor));
        }}
        onSeeAll={(acc) => {
          setSummaryAccount(null);
          const month =
            cursor.granularity === 'month' ? `&month=${periodRange(cursor).start.slice(0, 7)}` : '';
          router.navigate(`/transactions?account=${acc.id}${month}`);
        }}
      />

      {refundTx && (
        <TransactionDetailModal
          tx={refundTx}
          accounts={historyAccounts}
          categories={categories}
          onClose={() => setRefundTx(null)}
          onEdit={(tx) => {
            setRefundTx(null);
            router.push({ pathname: '/add-transaction', params: { id: tx.id } });
          }}
          onChanged={() => {
            setRefundTx(null);
            void load(cursorRef.current);
          }}
        />
      )}
      <AccountDetailModal
        account={editAccount}
        onClose={() => setEditAccount(null)}
        onChanged={async () => {
          setEditAccount(null);
          await load(cursor);
        }}
      />

      <AddAccountModal
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
        onCreated={async () => {
          setAddAccountVisible(false);
          await load(cursor);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  heroGap: { marginTop: 4 },
  bento: { marginTop: SCREEN.cardStack },
  recent: { marginHorizontal: SCREEN.gutter, overflow: 'hidden' },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
});
