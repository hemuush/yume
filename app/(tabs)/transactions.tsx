import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { useFreshness } from '@/lib/useFreshness';
import { View, FlatList, Pressable, Animated } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import ReanimatedAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts, listCategories, listTransactions, searchTransactions, setDayOrder } from '@/db/ledger';
import { getRangeComparison, PeriodComparison } from '@/db/reports';
import { Account, Category, Transaction, TransactionType } from '@/types';
import { HeaderIconButton } from '@/components/AppHeader';
import { SkyHeader } from '@/features/home/SkyHeader';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { theme } from '@/constants/theme';
import { useTabScrollPad } from '@/lib/uiScale';
import { toLocalIsoDate, addDaysToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { useSwipeDrag } from '@/lib/useSwipeDrag';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from '@/features/transactions/transactions.styles';
import { ActivityFilterChips, SearchStatus } from '@/features/transactions/ActivityFilterChips';
import { dayMonth, longMonth, longWeekday } from '@/lib/dateLabels';
import { PeriodPicker } from '@/components/PeriodPicker';
import { FilterModal } from '@/features/transactions/FilterModal';
import { TimelineDay } from '@/features/transactions/TimelineDay';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { TransactionsHeadline } from '@/features/transactions/TransactionsHeadline';
import { TransactionsSkeleton } from '@/features/transactions/TransactionsSkeleton';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { buildWeekSpendBars, buildWeeklySpendBars, legendForBars } from '@/features/transactions/spendChart';
import {
  weekContaining,
  stepWeekAnchor,
  weekCompareLabel,
  previousRangeFor,
  groupByDate,
  periodHeading,
  filterActivity,
} from '@/features/transactions/transactions.helpers';
import { savingsAccountIdsOf } from '@/lib/account';
import { privateComparison } from '@/lib/privateSummary';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from '@/features/home/homeInk';
import { haptics } from '@/lib/haptics';
import { errorMessage } from '@/lib/errorMessage';
import { DURATIONS } from '@/lib/motionTimings';
import { withPressed } from '@/lib/pressed';
import { categoryPath, parentNameOf } from '@/lib/categoryLabel';
import { EmptyState } from '@/components/EmptyState';
import { useTabScrollToTop } from '@/lib/useTabScrollToTop';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Fires the actual DB query this long after the last keystroke — typing
// "zomato" shouldn't run five separate queries for "z", "zo", "zom" ...
const SEARCH_DEBOUNCE_MS = 300;
// Below this, a query rarely narrows anything and firing on every keystroke of a short word is wasted work.
const SEARCH_MIN_CHARS = 2;
// Search spans the whole ledger, not one week/month — capped so a very
// common word doesn't dump years of history into one scroll.
const SEARCH_RESULT_LIMIT = 50;

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const { hideAmounts } = usePrivacy();
  const { accent, secondary } = useAccent();
  const ink = homeInk(accent);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  // The totals query failed: the list still loaded, so show it (with a note) rather than the skeleton forever.
  const [comparisonFailed, setComparisonFailed] = useState(false);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  // Refreshed on every focus, not frozen at mount: this tab never unmounts, so a `useMemo(..., [])` "today"
  // would report yesterday's date for anyone returning to it after midnight.
  const [todayDate, setTodayDate] = useState(() => new Date());
  const [anchor, setAnchor] = useState(todayDate);
  const [viewScope, setViewScope] = useState<'week' | 'month'>('week');
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
  // Search is its own mode, not a filter: it queries the whole ledger, so the period nav/chart/Filter
  // (which only apply to the loaded range) step aside while it is active.
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // Shared by the typing effect and edits/deletes made from a search result, so the list never shows a
  // stale or deleted row. Only the newest query may write results: closing/clearing the box bumps it too.
  const searchSeq = useRef(0);
  const runSearch = useCallback(async (trimmed: string) => {
    const seq = ++searchSeq.current;
    if (trimmed.length < SEARCH_MIN_CHARS) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchTransactions(trimmed, SEARCH_RESULT_LIMIT);
      if (seq === searchSeq.current) setSearchResults(results);
    } catch {
      // A failed search just shows "no matches" instead of an error banner: nothing destructive, and the
      // user can retry by editing the query.
      if (seq === searchSeq.current) setSearchResults([]);
    } finally {
      if (seq === searchSeq.current) setSearchLoading(false);
    }
  }, []);
  // A week is the Sunday-to-Saturday row of one calendar month, cut at the month's edges.
  const week = useMemo(() => weekContaining(anchor), [anchor]);
  const today = toLocalIsoDate(todayDate);
  const yesterday = addDaysToIsoDate(today, -1);
  const isCurrentWeek = today >= week.start && today <= week.end;
  const isCurrentMonth =
    anchor.getFullYear() === todayDate.getFullYear() && anchor.getMonth() === todayDate.getMonth();
  const [loadError, setLoadError] = useState<string | null>(null);
  // The header sits over the list and shrinks as it scrolls.
  const { collapse, headerHeight, collapsedHeight, scrollHandler, scrollRef } =
    useCollapsingHeader<FlatList<{ date: string; items: Transaction[] }>>();
  useTabScrollToTop(scrollRef);
  // Which stacked lines ("Food & Dining ×5") are open lives here, not in TimelineDay: FlatList unmounts
  // off-screen rows, and local state there would silently close a stack the user opened.
  const [openStacks, setOpenStacks] = useState<Set<string>>(new Set());
  const toggleStack = useCallback(
    (key: string) =>
      setOpenStacks((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    []
  );
  // Slide direction of the headline/chart on the next period change (read by TransactionsHeadline): 0
  // (crossfade) unless it is a one-step move; a picked month or Week↔Month switch has no direction.
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  // A link can open Activity already filtered: ?category= (a category page's
  // "See all") or ?account= (Home's account sheet), with ?month=YYYY-MM.
  const linkParams = useLocalSearchParams<{ category?: string; account?: string; month?: string }>();
  useEffect(() => {
    const { category, account, month } = linkParams;
    if (!category && !account) return;
    // A link shows its filter, not search results left open from before.
    searchSeq.current++;
    setSearching(false);
    setSearchQuery('');
    setSearchResults([]);
    setFilterType('all');
    setFilterCategoryIds(category ? [category] : []);
    setFilterAccountIds(account ? [account] : []);
    const [y, m] = month && /^\d{4}-\d{2}$/.test(month) ? month.split('-').map(Number) : [0, 0];
    // A real month that isn't in the future; anything else keeps the current view.
    const now = new Date();
    if (
      m >= 1 &&
      m <= 12 &&
      (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1))
    ) {
      setDirection(0);
      setAnchor(new Date(y, m - 1, 1));
      setViewScope('month');
    }
    router.setParams({ category: undefined, account: undefined, month: undefined });
  }, [linkParams]);
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
  const stepBackPress = usePressScale();
  const stepForwardPress = usePressScale();

  const monthRange = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    return { fromDate: toLocalIsoDate(new Date(y, m, 1)), toDate: toLocalIsoDate(new Date(y, m + 1, 0)) };
  }, [anchor]);
  const visibleRange = viewScope === 'month' ? monthRange : { fromDate: week.start, toDate: week.end };
  const filteredTransactions = useMemo(
    () =>
      filterActivity(
        transactions,
        { type: filterType, categoryIds: filterCategoryIds, accountIds: filterAccountIds },
        categories
      ),
    [transactions, filterType, filterCategoryIds, filterAccountIds, categories]
  );

  // Chart/headline show the real unfiltered period (only the rows follow Filter; hidden savings &
  // investment categories stay out). Week = bar per day; month = bar per week, as 28-31 bars crowded.
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  // The chart groups by top-level category like the headline does, and a group is hidden when the parent or
  // any of its subcategories is flagged, so a hidden group's entries leave the bars too, not just the total.
  const chartTransactions = useMemo(() => {
    if (!hideAmounts) return transactions;
    const hiddenGroups = new Set(categories.filter((c) => c.isSensitive).map((c) => c.parentId ?? c.id));
    return transactions.filter((t) => {
      const cat = t.categoryId ? categoriesById.get(t.categoryId) : undefined;
      return !cat || !hiddenGroups.has(cat.parentId ?? cat.id);
    });
  }, [transactions, categories, categoriesById, hideAmounts]);

  const heading = periodHeading({ scope: viewScope, week, anchor, today: todayDate });
  const groupedDays = useMemo(() => groupByDate(filteredTransactions), [filteredTransactions]);

  // Only the most recent load may write state — paging week/month quickly
  // starts overlapping loads, and an earlier one can finish last.
  const loadSeq = useRef(0);
  // The period the rows and totals on screen belong to: the pill moves at once, this catches up when the
  // period's data lands, and the Spent card and its bars follow it (never the pill).
  const [loadedPeriod, setLoadedPeriod] = useState<{
    fromDate: string;
    toDate: string;
    scope: 'week' | 'month';
  }>(() => ({ fromDate: '', toDate: '', scope: 'week' }));
  const load = useCallback(async (range: { fromDate: string; toDate: string }, scope: 'week' | 'month') => {
    const seq = ++loadSeq.current;
    let tx: Transaction[];
    try {
      const [rows, accs, cats] = await Promise.all([
        listTransactions(range),
        listAccounts(),
        listCategories(),
      ]);
      if (seq !== loadSeq.current) return false;
      tx = rows;
      setAccounts(accs);
      setCategories(cats);
      setLoadError(null);
    } catch (e) {
      if (seq !== loadSeq.current) return false;
      // A transient DB failure otherwise left stale/empty data with no hint anything went wrong (as on
      // other tabs).
      setLoadError(errorMessage(e));
      return false;
    }
    // Caught separately: the totals only feed the Spent figure and its change, so their failure must not
    // blank the list. The rows, the totals and the period they belong to land together, so the Spent card
    // never shows one period's figure under the next one's bars.
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
    setTransactions(tx);
    setComparison(cmp);
    setComparisonFailed(cmp == null);
    setLoadedPeriod({ fromDate: range.fromDate, toDate: range.toDate, scope });
    return cmp != null;
  }, []);

  const bars = useMemo(
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
  const legend = useMemo(() => legendForBars(bars), [bars]);

  // Destructured so the focus effect depends on primitive dates/scope, not the `visibleRange` object
  // rebuilt every render (which would re-run the load each time).
  const { fromDate: rangeFromDate, toDate: rangeToDate } = visibleRange;
  useEffect(() => setSelectedBar(null), [rangeFromDate, rangeToDate, viewScope]);
  const freshness = useFreshness();
  const searchState = useRef({ searching, query: searchQuery });
  useEffect(() => {
    searchState.current = { searching, query: searchQuery };
  }, [searching, searchQuery]);
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
      // the query so the list doesn't show the row as it was before. Read through a ref: typing must go
      // through the debounced search below, not re-run this on every keystroke.
      const live = searchState.current;
      if (live.searching) runSearch(live.query.trim());
    }, [load, rangeFromDate, rangeToDate, viewScope, runSearch, freshness])
  );
  // A save that doesn't leave this screen (the + long-press sheet) — reload in place.
  useEffect(
    () => onTransactionsChanged(() => void load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope)),
    [load, rangeFromDate, rangeToDate, viewScope]
  );

  // Debounced, cross-period text search — queries the whole ledger via
  // searchTransactions, independent of whatever week/month is loaded above.
  useEffect(() => {
    if (!searching) return;
    const trimmed = searchQuery.trim();
    // A new keystroke orphans any query still in flight, so its results can't land under the new text.
    searchSeq.current++;
    if (trimmed.length < SEARCH_MIN_CHARS) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const handle = setTimeout(() => runSearch(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searching, searchQuery, runSearch]);

  const openSearch = () => setSearching(true);
  const closeSearch = () => {
    searchSeq.current++;
    setSearching(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchLoading(false);
  };

  const searchGroupedDays = useMemo(() => groupByDate(searchResults), [searchResults]);
  const displayedGroups = searching ? searchGroupedDays : groupedDays;

  // Days can be arranged by hand, but only on the plain list: a search or filter shows
  // part of a day, and its order would be saved over the whole day.
  const noFilter = filterType === 'all' && filterCategoryIds.length === 0 && filterAccountIds.length === 0;
  const canReorder = !searching && noFilter;
  const [dragging, setDragging] = useState(false);
  const reorderDay = useCallback(
    async (date: string, orderedIds: string[]) => {
      await setDayOrder(date, orderedIds);
      await load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope);
    },
    [load, rangeFromDate, rangeToDate, viewScope]
  );
  const trimmedQuery = searchQuery.trim();

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
    if (selectedBar === key) {
      setSelectedBar(null);
      return;
    }
    // A bar counts every entry, but the list may be filtered: only pick a bar whose day is in the list.
    if (scrollToDay(key)) setSelectedBar(key);
  };

  // A jump that lands past what the list has measured retries once it has laid out (see onScrollToIndexFailed).
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    []
  );
  const scrollToDay = (key: string): boolean => {
    // Week scope: the bar key is already the group's date. Month scope: the key is a week bucket's start,
    // so jump to the first day in that week (up to 6 days on) that has a group.
    const targetDate =
      loadedPeriod.scope === 'week'
        ? key
        : groupedDays.find((g) => g.date >= key && g.date <= addDaysToIsoDate(key, 6))?.date;
    if (!targetDate) return false;
    const index = groupedDays.findIndex((g) => g.date === targetDate);
    if (index < 0) return false;
    // Lands just under the shrunk header.
    scrollRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0, viewOffset: collapsedHeight });
    return true;
  };

  // Built once per accounts/categories change instead of `.find()` per row per render (an O(V*C) scan,
  // repeated on every "expand a day" tap since that re-renders all mounted rows).
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  // Stable, so a day of the list only redraws when its own entries change.
  const accountName = useCallback((id: string) => accountsById.get(id)?.name ?? '—', [accountsById]);
  const categoryName = useCallback(
    (id: string | null) => (id ? categoriesById.get(id)?.name : undefined) ?? '—',
    [categoriesById]
  );
  // A filter chip is one line, so a subcategory carries its parent: "Food & Dining › Zomato".
  const categoryPathName = (id: string) => categoryPath(categoryName(id), parentNameOf(id, categoriesById));

  const savingsAccountIds = useMemo(() => savingsAccountIdsOf(accounts), [accounts]);
  const headline = useMemo(() => privateComparison(comparison, hideAmounts), [comparison, hideAmounts]);
  // How much more or less than the comparison period; the percent alone says little without a base.
  const expenseChangeMinor =
    headline && headline.expenseChangePct != null
      ? headline.current.expenseMinor - headline.previous.expenseMinor
      : null;
  // Categories and accounts picked in the filter sheet (the type has its own chips).
  const filterCount = filterCategoryIds.length + filterAccountIds.length;

  // Before the first successful load only (`loadError` set falls through to the inline error banner), the
  // list area shows the skeleton so "Nothing logged this month" doesn't flash before the data arrives. The
  // header stays the same one throughout, so nothing jumps when the data lands.
  const firstLoad = !comparison && !loadError && !comparisonFailed;

  // Under the header, at the top of the list: a load that failed, or totals that couldn't load.
  const banners = (
    <>
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn't load your transactions</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
        </View>
      )}

      {comparisonFailed && !loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn't load this period's totals</Text>
          <Text style={styles.errorDetail}>
            Your entries are below. Change the period or reopen this tab to try again.
          </Text>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
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
        filter={{ type: filterType, categoryIds: filterCategoryIds, accountIds: filterAccountIds }}
        onClose={() => setFilterVisible(false)}
        onApply={(next) => {
          setFilterType(next.type);
          setFilterCategoryIds(next.categoryIds);
          setFilterAccountIds(next.accountIds);
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
            ref={scrollRef}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            scrollEnabled={!dragging}
            data={displayedGroups}
            keyExtractor={(group) => group.date}
            // Each row is a whole day, so mount only a few at first and keep the window small.
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={7}
            contentContainerStyle={{
              // Under the header; search results have no headline above them, so keep the first day off the bar.
              paddingTop: headerHeight + (searching ? 14 : 0),
              paddingBottom: tabScrollPad + insets.bottom,
            }}
            // Variable-height days (line count, open stacks) rule out `getItemLayout`; standard fallback: if
            // a jump lands past what's measured, retry once the list has laid out.
            onScrollToIndexFailed={(info) => {
              if (retryTimer.current) clearTimeout(retryTimer.current);
              retryTimer.current = setTimeout(
                () =>
                  scrollRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0,
                    viewOffset: collapsedHeight,
                  }),
                250
              );
            }}
            ListHeaderComponent={
              searching ? (
                <>
                  {banners}
                  <SearchStatus
                    query={trimmedQuery}
                    minChars={SEARCH_MIN_CHARS}
                    loading={searchLoading}
                    resultCount={searchResults.length}
                  />
                </>
              ) : (
                <>
                  {banners}
                  <ReanimatedAnimated.View style={periodSwipe.dragStyle} {...periodSwipe.panHandlers}>
                    <TransactionsHeadline
                      periodKey={`${loadedPeriod.scope}-${loadedPeriod.fromDate}`}
                      direction={direction}
                      expenseMinor={headline?.current.expenseMinor ?? 0}
                      incomeMinor={headline?.current.incomeMinor ?? 0}
                      expenseChangeMinor={expenseChangeMinor}
                      viewScope={loadedPeriod.scope}
                      compareLabel={viewScope === 'week' ? weekCompareLabel(week, today) : undefined}
                      bars={bars}
                      legend={legend}
                      onPressDay={onPressBar}
                      selectedKey={selectedBar}
                      current={atCurrent}
                    />
                  </ReanimatedAnimated.View>

                  <ActivityFilterChips
                    filterType={filterType}
                    onFilterType={setFilterType}
                    categoryIds={filterCategoryIds}
                    accountIds={filterAccountIds}
                    categoryName={categoryPathName}
                    accountName={accountName}
                    onRemoveCategory={(id) => setFilterCategoryIds((ids) => ids.filter((x) => x !== id))}
                    onRemoveAccount={(id) => setFilterAccountIds((ids) => ids.filter((x) => x !== id))}
                    onClearAll={() => {
                      setFilterCategoryIds([]);
                      setFilterAccountIds([]);
                    }}
                  />

                  {/* The same Suu empty state as every other screen, not a bare line of grey text. */}
                  {accounts.length === 0 && (
                    <EmptyState title="No accounts yet" subtitle="Add an account before recording entries." />
                  )}
                  {accounts.length > 0 && transactions.length > 0 && filteredTransactions.length === 0 && (
                    <EmptyState title="Nothing matches" subtitle="Try removing a filter above." />
                  )}
                  {accounts.length > 0 && transactions.length === 0 && (
                    <EmptyState
                      title={viewScope === 'month' ? 'Nothing logged this month' : 'Nothing logged this week'}
                      subtitle="Tap + to add an entry, or look at another period."
                    />
                  )}
                </>
              )
            }
            renderItem={({ item: group, index: gi }) => (
              <TimelineDay
                date={group.date}
                label={
                  group.date === today
                    ? 'Today'
                    : group.date === yesterday
                      ? 'Yesterday'
                      : searching
                        ? dayMonth(group.date)
                        : longWeekday(group.date)
                }
                dateLabel={searching && group.date !== today ? group.date.slice(0, 4) : dayMonth(group.date)}
                items={group.items}
                categories={categories}
                accountName={accountName}
                categoryName={categoryName}
                onPressTx={setDetailTx}
                savingsAccountIds={savingsAccountIds}
                openStacks={openStacks}
                onToggleStack={toggleStack}
                onReorder={canReorder ? reorderDay : undefined}
                onDragActive={setDragging}
                entering={FadeIn.delay(Math.min(gi * 45, MAX_LIST_STAGGER_MS))
                  .duration(DURATIONS.enter)
                  .reduceMotion(ReduceMotion.System)}
              />
            )}
          />
        )}
      </View>

      {/* Over the list, which it shrinks with as it scrolls. */}
      <SkyHeader
        title="Activity"
        subtitle={SUBTITLE}
        collapse={collapse}
        wallpaper
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
              onPress={searching ? closeSearch : openSearch}
              label={searching ? 'Close search' : 'Search transactions'}
            />
            {!searching && (
              <HeaderIconButton
                icon="sliders"
                size={40}
                glass
                onPress={() => setFilterVisible(true)}
                label={filterCount > 0 ? `Filters, ${filterCount} on` : 'Filters'}
                count={filterCount}
              />
            )}
          </>
        }
      >
        {searching ? (
          <View style={styles.searchBarRow}>
            <View style={styles.searchBar}>
              <Feather name="search" size={16} color={theme.colors.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search notes, categories, amounts, dates…"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
                autoFocus
                returnKeyType="search"
                accessibilityLabel="Search transactions"
              />
            </View>
            <Pressable style={withPressed()} onPress={closeSearch} hitSlop={8} accessibilityRole="button">
              <Text style={styles.searchCancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          // ‹ This week › in a frosted pill, Week | Month beside it. Dragging the pill (or the Spent card
          // below) steps the period, same as the chevrons.
          <View style={styles.periodBar}>
            <View style={styles.periodRow} {...periodSwipe.panHandlers}>
              {/* Only the contents follow the finger, inside the clipped pill, so a drag never slides the
                  pill over the Week | Month switch beside it. */}
              <ReanimatedAnimated.View style={[styles.periodInner, periodSwipe.dragStyle]}>
                <AnimatedPressable
                  onPress={stepBack}
                  onPressIn={stepBackPress.onPressIn}
                  onPressOut={stepBackPress.onPressOut}
                  hitSlop={6}
                  style={[styles.periodNav, stepBackPress.animatedStyle]}
                  accessibilityRole="button"
                  accessibilityLabel={viewScope === 'month' ? 'Previous month' : 'Previous week'}
                >
                  <Feather name="chevron-left" size={16} color={theme.colors.textPrimary} />
                </AnimatedPressable>
                <Pressable
                  onPress={() => setMonthPickerVisible(true)}
                  hitSlop={6}
                  style={withPressed(styles.periodTitleBtn)}
                  accessibilityRole="button"
                  accessibilityLabel={`${heading.title}${heading.sub ? `, ${heading.sub}` : ''}. Pick a month`}
                >
                  <Text style={styles.periodTitle} numberOfLines={1}>
                    {heading.title}
                  </Text>
                  {!!heading.sub && (
                    <Text style={styles.periodSub} numberOfLines={1}>
                      {heading.sub}
                    </Text>
                  )}
                </Pressable>
                <AnimatedPressable
                  onPress={stepForward}
                  onPressIn={stepForwardPress.onPressIn}
                  onPressOut={stepForwardPress.onPressOut}
                  hitSlop={6}
                  disabled={atCurrent}
                  style={[styles.periodNav, atCurrent && styles.periodNavOff, stepForwardPress.animatedStyle]}
                  accessibilityRole="button"
                  accessibilityLabel={viewScope === 'month' ? 'Next month' : 'Next week'}
                  accessibilityState={{ disabled: atCurrent }}
                >
                  <Feather name="chevron-right" size={16} color={theme.colors.textPrimary} />
                </AnimatedPressable>
              </ReanimatedAnimated.View>
            </View>
            <View style={styles.scopeSwitch} accessibilityRole="radiogroup">
              {VIEW_SCOPES.map((o) => {
                const on = viewScope === o.value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => onChangeViewScope(o.value)}
                    hitSlop={4}
                    style={withPressed([styles.scopeBtn, on && { backgroundColor: ink }])}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.scopeText, on && styles.scopeTextOn]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </SkyHeader>

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
          if (searching) await runSearch(trimmedQuery);
        }}
      />
    </View>
  );
}

const SUBTITLE = 'Every entry, day by day';

const VIEW_SCOPES: { label: string; value: 'week' | 'month' }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];
