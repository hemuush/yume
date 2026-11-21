import { useLocalDayRefresh } from '@/hooks/useLocalDayRefresh';
import { Appear } from '@/components/Appear';
import { CONTENT_ENTER, staggerEnter } from '@/lib/animation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { useFreshness } from '@/hooks/useFreshness';
import { View, Pressable, RefreshControl, useWindowDimensions, type FlatListInstance } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import ReanimatedAnimated from 'react-native-reanimated';
import { PrimaryButton } from '@/components/PrimaryButton';
import { openAdd } from '@/lib/openAdd';
import { useFocusEffect, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setDayOrder } from '@/db/ledger';
import { getCachedCurrency } from '@/db/settings';
import type { Transaction } from '@/types';
import { HeaderIconButton } from '@/components/AppHeader';
import { SkyHeader } from '@/features/home/SkyHeader';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { theme } from '@/constants/theme';
import { useTabScrollPad } from '@/lib/uiScale';
import { toLocalIsoDate, addDaysToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { useSwipeDrag } from '@/hooks/useSwipeDrag';
import { styles } from '@/features/transactions/transactions.styles';
import { ActivityFilterChips, SearchStatus } from '@/features/transactions/ActivityFilterChips';
import { ActivityPeriodBar } from '@/features/transactions/ActivityPeriodBar';
import { useActivityLedger } from '@/features/transactions/useActivityLedger';
import { useActivitySearch } from '@/features/transactions/useActivitySearch';
import { useDayJump } from '@/features/transactions/useDayJump';
import { useStableSet } from '@/lib/stableData';
import { SEARCH_MIN_CHARS, SEARCH_RESULT_LIMIT } from '@/features/transactions/searchLimits';
import { dayMonth, longMonth, longWeekday, weekdayDayMonth } from '@/lib/dateLabels';
import { PeriodPicker } from '@/components/PeriodPicker';
import { FilterModal } from '@/features/transactions/FilterModal';
import { TimelineDay } from '@/features/transactions/TimelineDay';
import { createStackStore } from '@/features/transactions/stackStore';
import { useActivityLinks } from '@/features/transactions/useActivityLinks';
import { deleteTransaction, restoreTransaction } from '@/db/transactions';
import { useUndoToast } from '@/components/UndoToast';
import { showAlert } from '@/components/AppDialog';
import { errorMessage } from '@/lib/errorMessage';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { TransactionsHeadline } from '@/features/transactions/TransactionsHeadline';
import { ActivitySummaryStrip } from '@/features/transactions/ActivitySummaryStrip';
import { ModalSheet } from '@/components/ModalSheet';
import { TransactionsSkeleton } from '@/features/transactions/TransactionsSkeleton';
import { buildWeekSpendBars, buildWeeklySpendBars } from '@/features/transactions/spendChart';
import {
  weekContaining,
  stepWeekAnchor,
  weekCompareLabel,
  groupByDate,
  periodHeading,
  filterActivity,
  chartTransactionsFor,
  netActivitySpend,
  groupWithNotes,
  emptyPeriodTitle,
  searchDayLabel,
  searchSuggestionsFor,
  type ValueNote,
} from '@/features/transactions/transactions.helpers';
import type { ActivityType } from '@/features/transactions/activityFilter';
import { listValuationEvents } from '@/db/valuations';
import { investmentIdsOf } from '@/lib/investment';
import { savingsAccountIdsOf } from '@/lib/account';
import { privateComparison } from '@/lib/privateSummary';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { categoryPath, parentNameOf } from '@/lib/categoryLabel';
import { EmptyState } from '@/components/EmptyState';
import { useTabScrollToTop } from '@/hooks/useTabScrollToTop';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';

/** One empty list for "no value updates": a new one each time was a state change, and a redraw of every day. */
const NO_NOTES: ValueNote[] = [];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const tabScrollPad = useTabScrollPad();
  const { hideAmounts } = usePrivacy();
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const {
    transactions,
    accounts,
    categories,
    comparison,
    comparisonFailed,
    comparisonPending,
    loadError,
    loadedPeriod,
    isArriving,
    load,
  } = useActivityLedger();
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  // Refreshed on every focus, not frozen at mount: this tab never unmounts, so a `useMemo(..., [])` "today"
  // would report yesterday's date for anyone returning to it after midnight.
  const [todayDate, setTodayDate] = useState(() => new Date());
  const [anchor, setAnchor] = useState(todayDate);
  const [viewScope, setViewScope] = useState<'week' | 'month'>('week');
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(false);
  const [filterType, setFilterType] = useState<ActivityType>('all');
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [filterLabel, setFilterLabel] = useState<string | undefined>();
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
  const search = useActivitySearch(hideAmounts);
  const searching = search.active;
  // Stable, so effects and callbacks can list them without listing the whole `search` object.
  const { close: closeSearch, refresh: refreshSearch, remember: rememberSearch } = search;
  // A week is the Sunday-to-Saturday row of one calendar month, cut at the month's edges.
  const week = useMemo(() => weekContaining(anchor), [anchor]);
  const today = toLocalIsoDate(todayDate);
  const yesterday = addDaysToIsoDate(today, -1);
  const isCurrentWeek = today >= week.start && today <= week.end;
  const isCurrentMonth =
    anchor.getFullYear() === todayDate.getFullYear() && anchor.getMonth() === todayDate.getMonth();
  // The header sits over the list and shrinks as it scrolls.
  const { collapse, headerHeight, collapsedHeight, scrollHandler, scrollRef } =
    useCollapsingHeader<FlatListInstance>();
  useTabScrollToTop(scrollRef);
  const clearFilters = useCallback(() => {
    setFilterType('all');
    setFilterLabel(undefined);
    setFilterCategoryIds([]);
    setFilterAccountIds([]);
  }, []);
  // Which stacked lines ("Food & Dining ×5") are open lives here, not in TimelineDay: FlatList unmounts
  // off-screen rows, and local state there would silently close a stack the user opened. It is not React state:
  // opening a stack then re-renders that one line instead of this screen and the whole day.
  const [stacks] = useState(createStackStore);
  // Slide direction of the headline/chart on the next period change (read by TransactionsHeadline): 0
  // (crossfade) unless it is a one-step move; a picked month or Week↔Month switch has no direction.
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  // A link can open Activity already filtered, on a month, or on one entry (see useActivityLinks).
  useActivityLinks({
    accountsLoaded: accounts.length > 0,
    closeSearch,
    setFilterType,
    setFilterCategoryIds,
    setFilterAccountIds,
    setFilterLabel,
    setDirection,
    setAnchor,
    setViewScope,
    setDetailTx,
  });
  // The last-tapped chart bar lifts while the rest fade (see SpendBarChart); cleared on period change since
  // its key belongs to the old period's bars.
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  // Shared by the nav row's own chevron buttons and the swipe gesture below,
  // so stepping the period is one piece of logic instead of two copies.
  const stepBack = () => {
    haptics.tap();
    setDirection(-1);
    setAnchor((a) =>
      viewScope === 'month'
        ? new Date(a.getFullYear(), a.getMonth() - 1, 1)
        : stepWeekAnchor(a, -1, todayDate)
    );
  };
  const stepForward = () => {
    haptics.tap();
    setDirection(1);
    setAnchor((a) => {
      if (viewScope === 'week') return stepWeekAnchor(a, 1, todayDate);
      const next = new Date(a.getFullYear(), a.getMonth() + 1, 1);
      return next > todayDate ? todayDate : next;
    });
  };
  // A drag on the period pill or the Spent card moves it with the finger and steps the period like the
  // chevrons; `atCurrent` mirrors the forward button's guard, so swiping past the current week/month bounces back.
  const atCurrent = viewScope === 'month' ? isCurrentMonth : isCurrentWeek;
  const periodSwipe = useSwipeDrag((dir) => (dir < 0 ? stepBack() : stepForward()), !atCurrent);

  const monthRange = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    return { fromDate: toLocalIsoDate(new Date(y, m, 1)), toDate: toLocalIsoDate(new Date(y, m + 1, 0)) };
  }, [anchor]);
  const visibleRange = viewScope === 'month' ? monthRange : { fromDate: week.start, toDate: week.end };
  // Sets, labels and currencies the days of the list read, kept the same object while their content is: an account's
  // balance moves with every entry, and anything rebuilt around the whole account redrew every day after each edit.
  const investmentIds = useStableSet(useMemo(() => investmentIdsOf(accounts), [accounts]));
  const openInvestments = useCallback(() => router.push('/investments'), []);
  // Under the Invest chip, value updates of the holdings in view are listed beside the money moved.
  const [valueNotes, setValueNotes] = useState<{ from: string; to: string; rows: ValueNote[] } | null>(null);
  const [notesFailure, setNotesFailure] = useState<string | null>(null);
  const [notesRetry, setNotesRetry] = useState(0);
  const wantsNotes = filterType === 'invest' && !searching;
  const notesFrom = viewScope === 'month' ? monthRange.fromDate : week.start;
  const notesTo = viewScope === 'month' ? monthRange.toDate : week.end;
  useEffect(() => {
    if (!wantsNotes) {
      setValueNotes(null);
      setNotesFailure(null);
      return;
    }
    let live = true;
    listValuationEvents(notesFrom, notesTo)
      .then((events) => {
        if (live) {
          setValueNotes({ from: notesFrom, to: notesTo, rows: events });
          setNotesFailure(null);
        }
      })
      .catch(() => {
        if (live) {
          setValueNotes((prev) => (prev?.from === notesFrom && prev.to === notesTo ? prev : null));
          setNotesFailure(`${notesFrom}:${notesTo}`);
        }
      });
    return () => {
      live = false;
    };
  }, [wantsNotes, notesFrom, notesTo, notesRetry, transactions]);
  const filteredTransactions = useMemo(
    () =>
      filterActivity(
        transactions,
        {
          type: filterType,
          categoryIds: filterCategoryIds,
          accountIds: filterAccountIds,
          expenseLabel: filterLabel,
        },
        categories,
        investmentIds
      ),
    [transactions, filterType, filterCategoryIds, filterAccountIds, filterLabel, categories, investmentIds]
  );

  // Chart/headline show the real unfiltered period (only the rows follow Filter; hidden savings &
  // investment categories stay out). Week = bar per day; month = bar per week, as 28-31 bars crowded.
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const chartTransactions = useMemo(
    () => chartTransactionsFor(transactions, accountsById, categoriesById, getCachedCurrency(), hideAmounts),
    [transactions, accountsById, categoriesById, hideAmounts]
  );

  const requestedHeading = periodHeading({ scope: viewScope, week, anchor, today: todayDate });
  const shownNotes = useMemo(
    () =>
      wantsNotes && valueNotes?.from === loadedPeriod.fromDate && valueNotes.to === loadedPeriod.toDate
        ? valueNotes.rows.filter(
            (n) => filterAccountIds.length === 0 || filterAccountIds.includes(n.accountId)
          )
        : NO_NOTES,
    [wantsNotes, valueNotes, filterAccountIds, loadedPeriod]
  );
  const groupedDays = useMemo<{ date: string; items: Transaction[]; notes?: ValueNote[] }[]>(() => {
    const days = groupByDate(filteredTransactions);
    return wantsNotes ? groupWithNotes(days, shownNotes) : days;
  }, [filteredTransactions, wantsNotes, shownNotes]);

  const periodPending =
    loadedPeriod.fromDate !== visibleRange.fromDate ||
    loadedPeriod.toDate !== visibleRange.toDate ||
    loadedPeriod.scope !== viewScope;
  const loadedAnchor = loadedPeriod.fromDate ? parseLocalIsoDate(loadedPeriod.fromDate) : anchor;
  const heading = loadedPeriod.fromDate
    ? periodHeading({
        scope: loadedPeriod.scope,
        week: weekContaining(loadedAnchor),
        anchor: loadedAnchor,
        today: todayDate,
      })
    : requestedHeading;
  // A new period opens at its top: the list keeps its offset when its data is replaced, so picking a month from the
  // shrunk header would otherwise land mid-way down it with the Spent strip out of view.
  useScrollToTopOnChange(scrollRef, `${loadedPeriod.scope}-${loadedPeriod.fromDate}`);
  // Type chips organize the timeline. Account, category and label filters also scope the spending preview.
  const hasSpendFilters = !!(filterCategoryIds.length || filterAccountIds.length || filterLabel);
  const narrowedTransactions = useMemo(() => {
    if (!hasSpendFilters) return chartTransactions;
    return filterActivity(
      chartTransactions,
      {
        type: 'all',
        categoryIds: filterCategoryIds,
        accountIds: filterAccountIds,
        expenseLabel: filterLabel,
      },
      categories,
      investmentIds
    );
  }, [
    hasSpendFilters,
    chartTransactions,
    filterCategoryIds,
    filterAccountIds,
    filterLabel,
    categories,
    investmentIds,
  ]);
  const allBars = useMemo(
    () =>
      loadedPeriod.scope === 'week'
        ? buildWeekSpendBars(
            chartTransactions,
            categories,
            { start: loadedPeriod.fromDate, end: loadedPeriod.toDate },
            today
          )
        : buildWeeklySpendBars(
            chartTransactions,
            categories,
            loadedPeriod.fromDate,
            loadedPeriod.toDate,
            today
          ),
    [chartTransactions, categories, loadedPeriod, today]
  );
  const bars = useMemo(
    () =>
      narrowedTransactions === chartTransactions
        ? allBars
        : loadedPeriod.scope === 'week'
          ? buildWeekSpendBars(
              narrowedTransactions,
              categories,
              { start: loadedPeriod.fromDate, end: loadedPeriod.toDate },
              today
            )
          : buildWeeklySpendBars(
              narrowedTransactions,
              categories,
              loadedPeriod.fromDate,
              loadedPeriod.toDate,
              today
            ),
    [allBars, narrowedTransactions, chartTransactions, categories, loadedPeriod, today]
  );

  // Destructured so the focus effect depends on primitive dates/scope, not the `visibleRange` object
  // rebuilt every render (which would re-run the load each time).
  const { fromDate: rangeFromDate, toDate: rangeToDate } = visibleRange;
  useEffect(() => setSelectedBar(null), [rangeFromDate, rangeToDate, viewScope]);
  const freshness = useFreshness();
  useLocalDayRefresh(() => {
    const now = new Date();
    if ((viewScope === 'week' && isCurrentWeek) || (viewScope === 'month' && isCurrentMonth)) setAnchor(now);
    setTodayDate(now);
    void load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope);
  });
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
      const now = new Date();
      setTodayDate((prev) => (toLocalIsoDate(prev) === toLocalIsoDate(now) ? prev : now));
      // Nothing written since this period last loaded (and it's the same day): what's shown is current.
      // This also runs on every search keystroke, which no longer reloads the period each time.
      const deps = [load, rangeFromDate, rangeToDate, viewScope];
      if (!freshness.isFresh(deps)) {
        const started = freshness.start(deps);
        void load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope).then((ok) => {
          if (ok) freshness.commit(started);
        });
      }
      // Returning from the full add-transaction screen (edit/delete of a row opened from search): re-run
      // the query so the list doesn't show the row as it was before.
      refreshSearch();
    }, [load, rangeFromDate, rangeToDate, viewScope, refreshSearch, freshness])
  );
  // A save that doesn't leave this screen (the + long-press sheet) — reload in place.
  useEffect(
    () =>
      onTransactionsChanged(() => {
        if (!focused.current) return;
        void load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope);
        refreshSearch();
      }),
    [load, rangeFromDate, rangeToDate, viewScope, refreshSearch]
  );

  const openFromSearch = useCallback(
    (tx: Transaction) => {
      rememberSearch(search.query);
      setDetailTx(tx);
    },
    [rememberSearch, search.query]
  );

  const searchGroupedDays = useMemo(() => groupByDate(search.results), [search.results]);
  const displayedGroups: { date: string; items: Transaction[]; notes?: ValueNote[] }[] = searching
    ? searchGroupedDays
    : groupedDays;

  // Days can be arranged by hand, but only on the plain list: a search or filter shows
  // part of a day, and its order would be saved over the whole day.
  const noFilter =
    !filterLabel && filterType === 'all' && filterCategoryIds.length === 0 && filterAccountIds.length === 0;
  const canReorder = !searching && !periodPending && noFilter;
  const [dragging, setDragging] = useState(false);
  // Reads the period at the time of the call, so this stays the same function as the period changes: a new one
  // would make every day of the list redraw.
  const shown = useRef({ fromDate: rangeFromDate, toDate: rangeToDate, scope: viewScope });
  useEffect(() => {
    shown.current = { fromDate: rangeFromDate, toDate: rangeToDate, scope: viewScope };
  }, [rangeFromDate, rangeToDate, viewScope]);
  const reorderDay = useCallback(
    async (date: string, orderedIds: string[]) => {
      await setDayOrder(date, orderedIds);
      const now = shown.current;
      await load({ fromDate: now.fromDate, toDate: now.toDate }, now.scope);
    },
    [load]
  );

  const onChangeViewScope = (scope: 'week' | 'month') => {
    if (scope !== viewScope) haptics.tap();
    setDirection(0);
    // Month → Week lands on this week when it's the current month, otherwise on the month's first week.
    if (scope === 'week' && viewScope === 'month') {
      setAnchor(isCurrentMonth ? todayDate : new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    }
    setViewScope(scope);
  };

  const onPressBar = (key: string) => {
    haptics.tap();
    // A bar counts every entry, but the list may be filtered: only pick a bar whose day is in the list.
    if (!scrollToDay(key)) return false;
    setSelectedBar(key);
    return true;
  };

  const { scrollToDay, onScrollToIndexFailed } = useDayJump({
    scrollRef,
    collapsedHeight,
    days: groupedDays,
    scope: loadedPeriod.scope,
    listKey: `${loadedPeriod.scope}-${loadedPeriod.fromDate}-${rangeFromDate}-${rangeToDate}-${viewScope}-${searching}`,
  });

  // Stable, so a day of the list only redraws when its own entries change.
  const labelKey = useMemo(() => JSON.stringify(accounts.map((a) => [a.id, a.name, a.currency])), [accounts]);
  const accountLabels = useMemo(
    () =>
      new Map(
        (JSON.parse(labelKey) as [string, string, string][]).map(([id, name, currency]) => [
          id,
          { name, currency },
        ])
      ),
    [labelKey]
  );
  const accountName = useCallback((id: string) => accountLabels.get(id)?.name ?? '—', [accountLabels]);
  const accountCurrency = useCallback(
    (id: string) => accountLabels.get(id)?.currency ?? getCachedCurrency(),
    [accountLabels]
  );
  const categoryName = useCallback(
    (id: string | null) => (id ? categoriesById.get(id)?.name : undefined) ?? '—',
    [categoriesById]
  );
  // A filter chip is one line, so a subcategory carries its parent: "Food & Dining › Zomato".
  const categoryPathName = (id: string) => categoryPath(categoryName(id), parentNameOf(id, categoriesById));

  const savingsAccountIds = useStableSet(useMemo(() => savingsAccountIdsOf(accounts), [accounts]));
  const searchSuggestions = useMemo(
    () => searchSuggestionsFor(transactions, categoriesById, savingsAccountIds),
    [transactions, categoriesById, savingsAccountIds]
  );
  const headline = useMemo(() => privateComparison(comparison, hideAmounts), [comparison, hideAmounts]);
  // How much more or less than the comparison period; the percent alone says little without a base.
  const expenseChangeMinor =
    headline && headline.expenseChangePct != null
      ? headline.current.expenseMinor - headline.previous.expenseMinor
      : null;
  // Categories and accounts picked in the filter sheet (the type has its own chips).
  const filterCount = filterCategoryIds.length + filterAccountIds.length + (filterLabel ? 1 : 0);

  // Before the first successful load only (`loadError` set falls through to the inline error banner), the
  // list area shows the skeleton so "Nothing logged this month" doesn't flash before the data arrives. The
  // header stays the same one throughout, so nothing jumps when the data lands.
  const firstLoad = !loadedPeriod.fromDate && !loadError;

  const retryLoad = () => void load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope);
  // A swipe-to-delete on an entry: the same soft delete and undo as its detail sheet. Says whether it was deleted
  // (a linked entry is not: it has to be undone from its detail, and the row springs back).
  const { show: showUndo } = useUndoToast();
  const deleteBySwipe = useCallback(
    async (tx: Transaction) => {
      const reloadList = () => {
        void load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope);
        refreshSearch();
      };
      try {
        const snapshot = await deleteTransaction(tx.id);
        haptics.warn();
        reloadList();
        showUndo('Moved to Recently deleted', async () => {
          await restoreTransaction(snapshot);
          reloadList();
        });
        return true;
      } catch (e) {
        showAlert('Couldn’t delete', errorMessage(e));
        return false;
      }
    },
    [load, rangeFromDate, rangeToDate, viewScope, refreshSearch, showUndo]
  );
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope);
    } finally {
      setRefreshing(false);
    }
  };

  // Under the header, at the top of the list: a load that failed, or totals that couldn't load.
  const banners = (
    <>
      {loadError && (
        <Appear style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn’t load your transactions</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
          <PrimaryButton title="Try again" compact variant="secondary" onPress={retryLoad} />
        </Appear>
      )}

      {comparisonFailed && !loadError && !comparisonPending && (
        <Appear style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn’t refresh the period comparison</Text>
          <Text style={styles.errorDetail}>Spending and entries are still available.</Text>
          <PrimaryButton title="Try again" compact variant="secondary" onPress={retryLoad} />
        </Appear>
      )}
      {wantsNotes && notesFailure === `${loadedPeriod.fromDate}:${loadedPeriod.toDate}` && (
        <Appear style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn’t load investment value updates</Text>
          <PrimaryButton
            title="Try again"
            compact
            variant="secondary"
            onPress={() => setNotesRetry((n) => n + 1)}
          />
        </Appear>
      )}
    </>
  );

  // What the Spent strip and the Insights sheet both say about the period shown.
  const periodIsCurrent = today >= loadedPeriod.fromDate && today <= loadedPeriod.toDate;
  const narrowedTo = !hasSpendFilters
    ? null
    : filterAccountIds.length > 0 || filterLabel
      ? 'matching entries'
      : filterCategoryIds.length === 1
        ? categoryName(filterCategoryIds[0])
        : `${filterCategoryIds.length} categories`;
  const compareLabel =
    loadedPeriod.scope === 'week' && loadedPeriod.fromDate
      ? weekCompareLabel(weekContaining(parseLocalIsoDate(loadedPeriod.fromDate)), today)
      : `last ${loadedPeriod.scope}`;
  const scopedSpend = useMemo(() => netActivitySpend(narrowedTransactions), [narrowedTransactions]);
  const spentMinor =
    narrowedTo || !headline || comparisonPending || comparisonFailed
      ? scopedSpend
      : headline.current.expenseMinor;
  return (
    <View style={styles.container}>
      <PeriodPicker
        visible={monthPickerVisible}
        onClose={() => setMonthPickerVisible(false)}
        today={todayDate}
        selected={{ kind: 'month', year: anchor.getFullYear(), month: anchor.getMonth() }}
        onPickMonth={(y, m) => {
          // Lands on the month's last day (or today, for the month in progress), so the week view would
          // open on that month's latest week.
          const last = new Date(y, m + 1, 0);
          setDirection(0);
          setAnchor(last > todayDate ? todayDate : last);
          setViewScope('month');
          setMonthPickerVisible(false);
        }}
        onCurrent={() => {
          setDirection(0);
          setAnchor(todayDate);
          setMonthPickerVisible(false);
        }}
        weeks={{
          monthLabel: longMonth(toLocalIsoDate(anchor)),
          ranges: week.ranges,
          index: viewScope === 'week' ? week.index : null,
          onPick: (start) => {
            setDirection(0);
            setAnchor(parseLocalIsoDate(start));
            setViewScope('week');
            setMonthPickerVisible(false);
          },
        }}
      />

      <FilterModal
        visible={filterVisible}
        categories={categories}
        accounts={accounts}
        filter={{
          type: filterType,
          categoryIds: filterCategoryIds,
          accountIds: filterAccountIds,
          expenseLabel: filterLabel,
        }}
        onClose={() => setFilterVisible(false)}
        countFor={(next) => filterActivity(transactions, next, categories, investmentIds).length}
        onApply={(next) => {
          setFilterType(next.type);
          setFilterCategoryIds(next.categoryIds);
          setFilterAccountIds(next.accountIds);
          setFilterLabel(next.expenseLabel);
          setFilterVisible(false);
        }}
      />

      <View style={styles.listArea}>
        {firstLoad ? (
          <View style={{ paddingTop: headerHeight }}>
            <TransactionsSkeleton />
          </View>
        ) : (
          <ReanimatedAnimated.FlatList
            // A search result opens on the first tap, even with the keyboard up.
            keyboardShouldPersistTaps="handled"
            // Scrolling the results puts the keyboard away, so the lower entries are not hidden behind it.
            keyboardDismissMode={searching ? 'on-drag' : 'none'}
            ref={scrollRef}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            scrollEnabled={!dragging}
            // Search results are a lookup, not a period: nothing to reload there.
            refreshControl={
              searching ? undefined : (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={accent}
                  colors={[accent]}
                  // Android draws the spinner at the list's top edge, which is under the header.
                  progressViewOffset={headerHeight}
                />
              )
            }
            data={displayedGroups}
            keyExtractor={(group) => group.date}
            // Each row is a whole day, so mount only a few at first and keep the window small. A short batch every
            // 50 ms keeps each frame light while scrolling.
            initialNumToRender={4}
            maxToRenderPerBatch={2}
            updateCellsBatchingPeriod={50}
            windowSize={5}
            contentContainerStyle={{
              // Under the header; search results have no headline above them, so keep the first day off the bar.
              paddingTop: headerHeight + (searching ? 14 : 0),
              paddingBottom: tabScrollPad + insets.bottom,
            }}
            onScrollToIndexFailed={onScrollToIndexFailed}
            ListHeaderComponent={
              searching ? (
                <>
                  <SearchStatus
                    query={search.trimmed}
                    minChars={SEARCH_MIN_CHARS}
                    loading={search.loading}
                    failed={search.failed}
                    onRetry={() => search.run(search.trimmed)}
                    resultCount={search.results.length}
                    capped={search.capped}
                    limit={SEARCH_RESULT_LIMIT}
                    suggestions={searchSuggestions}
                    recent={search.recent}
                    onPick={search.setQuery}
                    onClearRecent={search.clearRecent}
                  />
                </>
              ) : (
                <>
                  {banners}
                  {!!loadedPeriod.fromDate && (
                    <ReanimatedAnimated.View style={periodSwipe.dragStyle} {...periodSwipe.panHandlers}>
                      <ActivitySummaryStrip
                        periodKey={`${loadedPeriod.scope}-${loadedPeriod.fromDate}`}
                        direction={direction}
                        spentMinor={spentMinor}
                        expenseChangeMinor={comparisonPending || comparisonFailed ? null : expenseChangeMinor}
                        compareLabel={compareLabel}
                        viewScope={loadedPeriod.scope}
                        bars={bars}
                        current={periodIsCurrent}
                        narrowedTo={narrowedTo}
                        onPress={() => {
                          haptics.tap();
                          setInsightsVisible(true);
                        }}
                      />
                    </ReanimatedAnimated.View>
                  )}

                  <ActivityFilterChips
                    onOpenFilters={() => setFilterVisible(true)}
                    filterCount={filterCount}
                    filterType={filterType}
                    onFilterType={(value) => {
                      if (value === filterType) return;
                      haptics.tap();
                      setFilterType(value);
                      if (value === 'income' || value === 'transfer') setFilterLabel(undefined);
                      if (value === 'transfer') setFilterCategoryIds([]);
                      else if (value !== 'all') {
                        setFilterCategoryIds((ids) =>
                          ids.filter((id) => categoriesById.get(id)?.kind === value)
                        );
                      }
                    }}
                    categoryIds={filterCategoryIds}
                    accountIds={filterAccountIds}
                    expenseLabel={filterLabel}
                    onRemoveLabel={() => setFilterLabel(undefined)}
                    categoryName={categoryPathName}
                    accountName={accountName}
                    onRemoveCategory={(id) => setFilterCategoryIds((ids) => ids.filter((x) => x !== id))}
                    onRemoveAccount={(id) => setFilterAccountIds((ids) => ids.filter((x) => x !== id))}
                    onClearAll={clearFilters}
                  />

                  {/* The same Suu empty state as every other screen, not a bare line of grey text. */}
                  {accounts.length === 0 && !loadError && (
                    <EmptyState title="No accounts yet" subtitle="Add an account before recording entries." />
                  )}
                  {accounts.length > 0 && transactions.length > 0 && groupedDays.length === 0 && (
                    <EmptyState
                      title="No entries match these filters"
                      subtitle="Clear the filters to see this period’s entries."
                    >
                      <PrimaryButton title="Clear filters" variant="secondary" onPress={clearFilters} />
                    </EmptyState>
                  )}
                  {!loadError &&
                    accounts.length > 0 &&
                    groupedDays.length === 0 &&
                    transactions.length === 0 && (
                      <EmptyState
                        title={emptyPeriodTitle({
                          scope: loadedPeriod.scope,
                          current: periodIsCurrent,
                          title: heading.title,
                          from: loadedPeriod.fromDate,
                          today: todayDate,
                        })}
                        subtitle="Add an entry, or look at another period."
                      >
                        <PrimaryButton
                          title="Add an entry"
                          variant="secondary"
                          onPress={() => void openAdd()}
                        />
                      </EmptyState>
                    )}
                </>
              )
            }
            renderItem={({ item: group, index }) => (
              <TimelineDay
                accountCurrency={accountCurrency}
                date={group.date}
                label={
                  group.date === today
                    ? 'Today'
                    : group.date === yesterday
                      ? 'Yesterday'
                      : searching
                        ? searchDayLabel(group.date, todayDate)
                        : longWeekday(group.date)
                }
                dateLabel={
                  searching && group.date !== today
                    ? longWeekday(group.date)
                    : group.date === today || group.date === yesterday
                      ? weekdayDayMonth(group.date)
                      : dayMonth(group.date)
                }
                // Today and yesterday are named alone, as in Home; any other day says its date too.
                dateInHeading={group.date !== today && group.date !== yesterday}
                entering={isArriving() ? staggerEnter(index) : undefined}
                items={group.items}
                categories={categories}
                accountName={accountName}
                categoryName={categoryName}
                onPressTx={searching ? openFromSearch : setDetailTx}
                savingsAccountIds={savingsAccountIds}
                investmentIds={investmentIds}
                notes={group.notes}
                onPressNote={openInvestments}
                stacks={stacks}
                onReorder={canReorder ? reorderDay : undefined}
                onDragActive={setDragging}
                onSwipeDelete={deleteBySwipe}
                selected={
                  !searching &&
                  selectedBar != null &&
                  (loadedPeriod.scope === 'week'
                    ? selectedBar === group.date
                    : group.date >= selectedBar && group.date <= addDaysToIsoDate(selectedBar, 6))
                }
              />
            )}
          />
        )}
      </View>

      {/* Over the list, which it shrinks with as it scrolls. */}
      <SkyHeader
        title="Activity"
        expandedTitleSize={26}
        collapse={collapse}
        wallpaper
        backdropColor={theme.colors.home.background}
        collapsedAccessory={
          searching ? undefined : (
            <Pressable
              onPress={() => setMonthPickerVisible(true)}
              hitSlop={8}
              style={withPressed(styles.periodChip)}
              accessibilityRole="button"
              accessibilityLabel={`${heading.title}. Pick a month`}
            >
              <Text style={styles.periodChipText} numberOfLines={1}>
                {heading.title} ▾
              </Text>
            </Pressable>
          )
        }
        actions={
          <>
            <HeaderIconButton
              icon="search"
              size={40}
              glass
              onPress={searching ? closeSearch : search.open}
              label={searching ? 'Close search' : 'Search transactions'}
            />
          </>
        }
      >
        {searching ? (
          <View style={styles.searchBarRow}>
            <View style={styles.searchBar}>
              <Feather name="search" size={16} color={theme.colors.textMuted} />
              <TextInput
                value={search.query}
                onChangeText={search.setQuery}
                placeholder="Search notes, categories, amounts, dates…"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => rememberSearch(search.query)}
                accessibilityLabel="Search transactions"
              />
              {search.query.length > 0 && (
                <HeaderIconButton
                  icon="x"
                  size={44}
                  label="Clear search"
                  onPress={() => search.setQuery('')}
                />
              )}
            </View>
            <Pressable
              style={withPressed(styles.searchCancelBtn)}
              onPress={closeSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel search"
            >
              <Text style={styles.searchCancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityPeriodBar
            heading={heading}
            updating={periodPending && !loadError}
            scope={viewScope}
            atCurrent={atCurrent}
            swipe={periodSwipe}
            onStepBack={stepBack}
            onStepForward={stepForward}
            onPickMonth={() => setMonthPickerVisible(true)}
            onScope={onChangeViewScope}
          />
        )}
      </SkyHeader>

      {/* While a line is lifted: how to move it. The arrows stay available to screen readers as actions. */}
      {dragging && (
        <ReanimatedAnimated.View
          entering={CONTENT_ENTER}
          pointerEvents="none"
          style={[styles.dragHint, { bottom: insets.bottom + tabScrollPad - 12, backgroundColor: ink }]}
        >
          <Feather name="move" size={16} color={theme.colors.onInk} />
          <Text style={styles.dragHintText}>Drag up or down, let go to drop it</Text>
        </ReanimatedAnimated.View>
      )}

      <ModalSheet
        ledgerStyle
        visible={insightsVisible}
        onClose={() => setInsightsVisible(false)}
        title="Insights"
        subtitle={heading.title}
        // A short sheet with nothing to type into: it sits flush at the bottom. It scrolls only when large
        // text or a short screen would make it taller than the phone.
        scrollable={fontScale > 1.2 || height < 700}
      >
        <TransactionsHeadline
          bare
          periodKey={`${loadedPeriod.scope}-${loadedPeriod.fromDate}`}
          direction={direction}
          expenseMinor={spentMinor}
          incomeMinor={comparisonPending || comparisonFailed ? 0 : (headline?.current.incomeMinor ?? 0)}
          expenseChangeMinor={comparisonPending || comparisonFailed ? null : expenseChangeMinor}
          viewScope={loadedPeriod.scope}
          compareLabel={compareLabel}
          bars={bars}
          // Picking a day answers in the list: the sheet steps aside first so the day is in view.
          onPressDay={(key) => {
            if (onPressBar(key)) setInsightsVisible(false);
          }}
          selectedKey={selectedBar}
          current={periodIsCurrent}
          narrowedTo={narrowedTo}
        />
      </ModalSheet>

      <TransactionDetailModal
        tx={detailTx}
        accounts={accounts}
        categories={categories}
        onClose={() => setDetailTx(null)}
        onEdit={(tx) => {
          setDetailTx(null);
          router.push(`/add-transaction?id=${tx.id}`);
        }}
        onChanged={async () => {
          setDetailTx(null);
          await load(visibleRange, viewScope);
          if (searching) await search.run(search.trimmed);
        }}
      />
    </View>
  );
}
