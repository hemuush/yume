import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { useFreshness } from '@/lib/useFreshness';
import { View, FlatList, Pressable, Animated, StyleSheet } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import ReanimatedAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { listAccounts, listCategories, listTransactions, searchTransactions, setDayOrder } from '@/db/ledger';
import { getRangeComparison, PeriodComparison } from '@/db/reports';
import { Account, Category, Transaction, TransactionType } from '@/types';
import { AppHeader, HeaderIconButton } from '@/components/AppHeader';
import { theme } from '@/constants/theme';
import { toLocalIsoDate, parseLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { useSwipeDrag } from '@/lib/useSwipeDrag';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from '@/features/transactions/transactions.styles';
import { ActivityFilterChips, SearchStatus } from '@/features/transactions/ActivityFilterChips';
import { dayMonth, longWeekday } from '@/lib/dateLabels';
import { MonthPickerModal } from '@/features/transactions/MonthPickerModal';
import { FilterModal } from '@/features/transactions/FilterModal';
import { TimelineDay } from '@/features/transactions/TimelineDay';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { TransactionsHeadline } from '@/features/transactions/TransactionsHeadline';
import { TransactionsSkeleton } from '@/features/transactions/TransactionsSkeleton';
import { WeekRail } from '@/features/transactions/WeekRail';
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
import { haptics } from '@/lib/haptics';
import { errorMessage } from '@/lib/errorMessage';
import { DURATIONS } from '@/lib/motionTimings';
import { withPressed } from '@/lib/pressed';
import { categoryPath, parentNameOf } from '@/lib/categoryLabel';
import { EmptyState } from '@/components/EmptyState';

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
  const { hideAmounts } = usePrivacy();
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
  const scrollRef = useRef<FlatList<{ date: string; items: Transaction[] }>>(null);
  // 0 at the top, 1 once scrolled: the fade under the fixed header, so rows slide under it instead of being cut flat.
  const [edgeFade] = useState(() => new Animated.Value(0));
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
    setFilterType('all');
    setFilterCategoryIds(category ? [category] : []);
    setFilterAccountIds(account ? [account] : []);
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
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
  // A drag on the nav row, the rail or the Spent card moves them with the finger and steps the period like the
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
  const chartTransactions = useMemo(
    () =>
      hideAmounts
        ? transactions.filter(
            (t) => !(t.categoryId && categories.find((c) => c.id === t.categoryId)?.isSensitive)
          )
        : transactions,
    [transactions, categories, hideAmounts]
  );
  const bars = useMemo(
    () =>
      viewScope === 'week'
        ? buildWeekSpendBars(
            chartTransactions,
            categories,
            { start: visibleRange.fromDate, end: visibleRange.toDate },
            today
          )
        : buildWeeklySpendBars(
            chartTransactions,
            categories,
            visibleRange.fromDate,
            visibleRange.toDate,
            today
          ),
    [chartTransactions, categories, viewScope, visibleRange.fromDate, visibleRange.toDate, today]
  );
  const legend = useMemo(() => legendForBars(bars), [bars]);
  const heading = periodHeading({ scope: viewScope, week, anchor, today: todayDate });
  const groupedDays = useMemo(() => groupByDate(filteredTransactions), [filteredTransactions]);

  // Only the most recent load may write state — paging week/month quickly
  // starts overlapping loads, and an earlier one can finish last.
  const loadSeq = useRef(0);
  const load = useCallback(async (range: { fromDate: string; toDate: string }, scope: 'week' | 'month') => {
    const seq = ++loadSeq.current;
    try {
      const [tx, accs, cats] = await Promise.all([listTransactions(range), listAccounts(), listCategories()]);
      if (seq !== loadSeq.current) return false;
      setTransactions(tx);
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
    // Fetched and caught separately: it only feeds the secondary "N% more/less than last …" figure, so its
    // failure (or a slower query) must not blank the transaction list.
    try {
      const prev = previousRangeFor(range, scope, toLocalIsoDate(new Date()));
      const cmp = await getRangeComparison(
        { start: range.fromDate, end: range.toDate },
        { start: prev.fromDate, end: prev.toDate },
        scope
      );
      if (seq === loadSeq.current) {
        setComparison(cmp);
        setComparisonFailed(false);
      }
    } catch {
      if (seq === loadSeq.current) {
        setComparison(null);
        setComparisonFailed(true);
      }
      return false;
    }
    return seq === loadSeq.current;
  }, []);

  // Destructured so the focus effect depends on primitive dates/scope, not the `visibleRange` object
  // rebuilt every render (which would re-run the load each time).
  const { fromDate: rangeFromDate, toDate: rangeToDate } = visibleRange;
  useEffect(() => setSelectedBar(null), [rangeFromDate, rangeToDate, viewScope]);
  const freshness = useFreshness();
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
      if (searching) runSearch(searchQuery.trim());
    }, [load, rangeFromDate, rangeToDate, viewScope, searching, searchQuery, runSearch, freshness])
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
    setSelectedBar(key);
    scrollToDay(key);
  };

  const scrollToDay = (key: string) => {
    // Week scope: the bar key is already the group's date. Month scope: the key is a week bucket's start,
    // so jump to the first day in that week (up to 6 days on) that has a group.
    const targetDate =
      viewScope === 'week'
        ? key
        : groupedDays.find((g) => g.date >= key && g.date <= addDaysToIsoDate(key, 6))?.date;
    if (!targetDate) return;
    const index = groupedDays.findIndex((g) => g.date === targetDate);
    if (index >= 0) scrollRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  };

  // Built once per accounts/categories change instead of `.find()` per row per render (an O(V*C) scan,
  // repeated on every "expand a day" tap since that re-renders all mounted rows).
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountName = (id: string) => accountsById.get(id)?.name ?? '—';
  const categoryName = (id: string | null) => (id ? categoriesById.get(id)?.name : undefined) ?? '—';
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

  // Before the first successful load only (`loadError` set falls through to the inline error banner), show
  // a spinner so "Nothing logged this month" doesn't flash before the data arrives.
  if (!comparison && !loadError && !comparisonFailed) {
    return (
      <View style={styles.container}>
        <AppHeader title="Activity" />
        <TransactionsSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Activity"
        right={
          <View style={styles.headerActions}>
            <HeaderIconButton
              icon="search"
              onPress={searching ? closeSearch : openSearch}
              label={searching ? 'Close search' : 'Search transactions'}
            />
            {!searching && (
              <HeaderIconButton
                icon="sliders"
                onPress={() => setFilterVisible(true)}
                label={filterCount > 0 ? `Filters, ${filterCount} on` : 'Filters'}
                count={filterCount}
              />
            )}
          </View>
        }
      />

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

      {searching && (
        <View style={styles.searchBarRow}>
          <View style={styles.searchBar}>
            <Feather name="search" size={14} color={theme.colors.textMuted} />
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
      )}

      {!searching && (
        // ‹ This week › centred, its dates under it. Dragging the row (or the rail and Spent card below it)
        // steps the period, same as the chevrons.
        <ReanimatedAnimated.View
          style={[styles.periodRow, periodSwipe.dragStyle]}
          {...periodSwipe.panHandlers}
        >
          <AnimatedPressable
            onPress={stepBack}
            onPressIn={stepBackPress.onPressIn}
            onPressOut={stepBackPress.onPressOut}
            hitSlop={6}
            style={[styles.periodNav, stepBackPress.animatedStyle]}
            accessibilityRole="button"
            accessibilityLabel={viewScope === 'month' ? 'Previous month' : 'Previous week'}
          >
            <Feather name="chevron-left" size={18} color={theme.colors.textPrimary} />
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
            <Feather name="chevron-right" size={18} color={theme.colors.textPrimary} />
          </AnimatedPressable>
        </ReanimatedAnimated.View>
      )}

      <MonthPickerModal
        visible={monthPickerVisible}
        anchor={anchor}
        todayDate={todayDate}
        onClose={() => setMonthPickerVisible(false)}
        onPick={(d) => {
          setDirection(0);
          setAnchor(d);
          setViewScope('month');
          setMonthPickerVisible(false);
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
        <FlatList
          ref={scrollRef}
          onScroll={(e) => edgeFade.setValue(Math.min(1, e.nativeEvent.contentOffset.y / 24))}
          scrollEventThrottle={16}
          scrollEnabled={!dragging}
          data={displayedGroups}
          keyExtractor={(group) => group.date}
          contentContainerStyle={{
            // Search results have no header above them: keep the first day off the search bar.
            paddingTop: searching ? 14 : 0,
            paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
          }}
          // Variable-height days (line count, open stacks) rule out `getItemLayout`; standard fallback: if
          // a jump lands past what's measured, retry once the list has laid out.
          onScrollToIndexFailed={(info) => {
            setTimeout(() => scrollRef.current?.scrollToIndex({ index: info.index, animated: true }), 250);
          }}
          ListHeaderComponent={
            searching ? (
              <SearchStatus
                query={trimmedQuery}
                minChars={SEARCH_MIN_CHARS}
                loading={searchLoading}
                resultCount={searchResults.length}
              />
            ) : (
              <>
                <ReanimatedAnimated.View style={periodSwipe.dragStyle} {...periodSwipe.panHandlers}>
                  {viewScope === 'week' && (
                    <WeekRail
                      week={week}
                      todayIso={today}
                      onPickWeek={(start) => {
                        haptics.tap();
                        setDirection(start < week.start ? -1 : 1);
                        setAnchor(parseLocalIsoDate(start));
                      }}
                    />
                  )}

                  <TransactionsHeadline
                    periodKey={`${viewScope}-${anchor.toDateString()}`}
                    direction={direction}
                    expenseMinor={headline?.current.expenseMinor ?? 0}
                    incomeMinor={headline?.current.incomeMinor ?? 0}
                    expenseChangeMinor={expenseChangeMinor}
                    viewScope={viewScope}
                    compareLabel={viewScope === 'week' ? weekCompareLabel(week, today) : undefined}
                    onChangeViewScope={onChangeViewScope}
                    bars={bars}
                    legend={legend}
                    onPressDay={onPressBar}
                    selectedKey={selectedBar}
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
        <Animated.View style={[styles.edgeFade, { opacity: edgeFade }]} pointerEvents="none">
          <LinearGradient colors={EDGE_FADE} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

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

const EDGE_FADE = [`${theme.colors.background}F2`, `${theme.colors.background}00`] as const;
