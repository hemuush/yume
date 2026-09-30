import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { View, FlatList, Pressable, Animated } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts, listCategories, listTransactions, searchTransactions, setDayOrder } from '@/db/ledger';
import { getRangeComparison, PeriodComparison } from '@/db/reports';
import { Account, Category, Transaction, TransactionType } from '@/types';
import { AppHeader, HeaderIconButton } from '@/components/AppHeader';
import { theme } from '@/constants/theme';
import { toLocalIsoDate, parseLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { useSwipeStep } from '@/lib/useSwipeStep';
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
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { errorMessage } from '@/lib/errorMessage';
import { DURATIONS } from '@/lib/motionTimings';
import { withPressed } from '@/lib/pressed';
import { EmptyState } from '@/components/EmptyState';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Fires the actual DB query this long after the last keystroke — typing
// "zomato" shouldn't run five separate queries for "z", "zo", "zom" ...
const SEARCH_DEBOUNCE_MS = 300;
// Below this, there's rarely enough signal in the query to narrow anything
// meaningfully, and firing a query on every single keystroke of a short
// word is wasted work.
const SEARCH_MIN_CHARS = 2;
// Search spans the whole ledger, not one week/month — capped so a very
// common word doesn't dump years of history into one scroll.
const SEARCH_RESULT_LIMIT = 50;

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  // Refreshed on every focus (below), not frozen at mount — this screen
  // stays alive for the whole app session (it's a tab, never unmounted), so
  // a `useMemo(..., [])` "today" would keep reporting yesterday's date to
  // anyone who opens the app before midnight and returns to this tab after.
  const [todayDate, setTodayDate] = useState(() => new Date());
  const [anchor, setAnchor] = useState(todayDate);
  const [viewScope, setViewScope] = useState<'week' | 'month'>('week');
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
  // Search is its own mode, not a filter layered on the current week/month —
  // it queries the whole ledger, so the period nav/chart/Filter (which only
  // ever apply to what's already loaded for the visible range) step aside
  // while it's active rather than trying to combine with it.
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // Extracted so both the debounced typing effect below and a transaction
  // edited/deleted from within a search result (via TransactionDetailModal,
  // and via the focus effect below for the full add-transaction screen) can
  // re-run the same query — otherwise either path would leave the search
  // list showing a row exactly as it was before the edit, or one that no
  // longer exists at all after a delete.
  const runSearch = useCallback(async (trimmed: string) => {
    if (trimmed.length < SEARCH_MIN_CHARS) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchTransactions(trimmed, SEARCH_RESULT_LIMIT);
      setSearchResults(results);
    } catch {
      // A failed search just shows "no matches" rather than its own error
      // banner — nothing here is destructive or worth interrupting typing
      // over, and the query can simply be retried by editing it further.
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
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
  // Which stacked lines ("Food & Dining ×5") are open, kept here rather than
  // inside TimelineDay — each day is a row in the FlatList below, which
  // unmounts/remounts rows as they scroll off- and back on-screen, and local
  // state there would silently close a stack the user had just opened.
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
  // Which way the headline/chart should slide on the next period change —
  // set alongside stepBack/stepForward/onPick/the scope toggle below, read
  // by TransactionsHeadline. 0 (a plain crossfade) for anything that isn't a
  // simple one-step move: picking an arbitrary month, or switching Week↔Month
  // itself, where a guessed slide direction wouldn't mean anything.
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
  // The chart bar last tapped — it lifts and the rest fade (see
  // SpendBarChart). Cleared whenever the period changes, since its key
  // belongs to the old period's bars.
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
  // A drag anywhere on the nav row steps the period the same as tapping its
  // own chevrons — `atCurrent` mirrors the same guard the forward button
  // itself uses, so swiping past "This week"/the current month is a no-op
  // rather than sliding into the future.
  const atCurrent = viewScope === 'month' ? isCurrentMonth : isCurrentWeek;
  const weekNavSwipe = useSwipeStep(stepBack, () => !atCurrent && stepForward());
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

  // The chart and headline reflect the real, unfiltered period — same as
  // Apple Card's own spending chart, which a category filter never changes.
  // Only the list of rows below responds to the Filter button.
  //
  // Week scope charts one bar per day (7, always readable). Month scope
  // charts one bar per calendar week (~4-5) rather than one per day
  // (28-31) — a dense day-per-bar grid for a whole month was both hard to
  // read and, at that many bars squeezed into one row, could visually
  // crowd/overlap (see SpendBarChart's own note on why very large `flex`
  // ratios don't lay out reliably). Week-level bars sidestep both problems.
  const bars = useMemo(
    () =>
      viewScope === 'week'
        ? buildWeekSpendBars(
            transactions,
            categories,
            { start: visibleRange.fromDate, end: visibleRange.toDate },
            today
          )
        : buildWeeklySpendBars(transactions, categories, visibleRange.fromDate, visibleRange.toDate, today),
    [transactions, categories, viewScope, visibleRange.fromDate, visibleRange.toDate, today]
  );
  const legend = useMemo(() => legendForBars(bars), [bars]);
  const heading = periodHeading({ scope: viewScope, week, anchor, today: todayDate });
  const pickedBar = bars.find((b) => b.key === selectedBar);
  // What the tapped bar cost; nothing until one is tapped (the bars say they can be tapped by being bars).
  const barHint = pickedBar
    ? {
        title:
          viewScope === 'week'
            ? parseLocalIsoDate(pickedBar.key).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              })
            : `Week of ${dayMonth(pickedBar.key)}`,
        detail: pickedBar.totalMinor > 0 ? `${formatMoney(pickedBar.totalMinor)} spent` : 'nothing spent',
      }
    : null;
  const groupedDays = useMemo(() => groupByDate(filteredTransactions), [filteredTransactions]);

  // Only the most recent load may write state — paging week/month quickly
  // starts overlapping loads, and an earlier one can finish last.
  const loadSeq = useRef(0);
  const load = useCallback(async (range: { fromDate: string; toDate: string }, scope: 'week' | 'month') => {
    const seq = ++loadSeq.current;
    try {
      const [tx, accs, cats] = await Promise.all([listTransactions(range), listAccounts(), listCategories()]);
      if (seq !== loadSeq.current) return;
      setTransactions(tx);
      setAccounts(accs);
      setCategories(cats);
      setLoadError(null);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      // Previously unguarded — a transient DB failure left the screen
      // silently showing stale/empty data with no indication anything
      // went wrong, the same class of bug already fixed on the other tabs.
      setLoadError(errorMessage(e));
    }
    // Fetched and caught separately from the list/accounts/categories above
    // — this only feeds the secondary "N% more/less than last …" headline
    // figure, so a failure here (or the comparison query being slower than
    // the rest) shouldn't blank the transaction list itself.
    try {
      const prev = previousRangeFor(range, scope, toLocalIsoDate(new Date()));
      const cmp = await getRangeComparison(
        { start: range.fromDate, end: range.toDate },
        { start: prev.fromDate, end: prev.toDate },
        scope
      );
      if (seq === loadSeq.current) setComparison(cmp);
    } catch {
      if (seq === loadSeq.current) setComparison(null);
    }
  }, []);

  // Destructured so the focus effect depends on the primitive dates/scope,
  // not the fresh `visibleRange` object rebuilt every render (which would
  // re-run the load on every render).
  const { fromDate: rangeFromDate, toDate: rangeToDate } = visibleRange;
  useEffect(() => setSelectedBar(null), [rangeFromDate, rangeToDate, viewScope]);
  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      setTodayDate((prev) => (toLocalIsoDate(prev) === toLocalIsoDate(now) ? prev : now));
      load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope);
      // Coming back from the full add-transaction screen (edited or deleted
      // a row reached from a search result) — re-run the same query so the
      // list doesn't keep showing it exactly as it was before that edit.
      if (searching) runSearch(searchQuery.trim());
    }, [load, rangeFromDate, rangeToDate, viewScope, searching, searchQuery, runSearch])
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
    // Week scope: the bar's own key is already the exact date a group is
    // keyed by. Month scope: the key is a week-bucket's start date, so jump
    // to the first day within that week (up to 6 days later) that actually
    // has a group — there's no single offset for "a week" itself.
    const targetDate =
      viewScope === 'week'
        ? key
        : groupedDays.find((g) => g.date >= key && g.date <= addDaysToIsoDate(key, 6))?.date;
    if (!targetDate) return;
    const index = groupedDays.findIndex((g) => g.date === targetDate);
    if (index >= 0) scrollRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  };

  // Built once per accounts/categories change rather than `.find()`-ing
  // through the full list for every transaction row on every render — with
  // C categories and V visible rows that was an O(V*C) scan (repeated again
  // on each "expand a day" tap, since that re-renders every mounted row).
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountName = (id: string) => accountsById.get(id)?.name ?? '—';
  const categoryName = (id: string | null) => (id ? categoriesById.get(id)?.name : undefined) ?? '—';

  const expenseChangePct = comparison?.expenseChangePct ?? null;
  // Categories and accounts picked in the filter sheet (the type has its own chips).
  const filterCount = filterCategoryIds.length + filterAccountIds.length;

  // Before the first successful load (and only then — `loadError` set means
  // fall through to the normal render, which already shows an inline error
  // banner), a plain spinner beats letting "Nothing logged this month" flash
  // on screen before the real data has even arrived.
  if (!comparison && !loadError) {
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
        // ‹ This week › centred, its dates under it. Dragging anywhere on the
        // row steps the period, same as the chevrons.
        <View style={styles.periodRow} {...weekNavSwipe.panHandlers}>
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
        </View>
      )}

      {!searching && viewScope === 'week' && (
        <WeekRail
          week={week}
          monthLabel={`${anchor.toLocaleDateString(undefined, { month: 'short' })} ${anchor.getFullYear()}`}
          todayIso={today}
          onPickWeek={(start) => {
            haptics.tap();
            setDirection(start < week.start ? -1 : 1);
            setAnchor(parseLocalIsoDate(start));
          }}
        />
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

      <FlatList
        ref={scrollRef}
        scrollEnabled={!dragging}
        data={displayedGroups}
        keyExtractor={(group) => group.date}
        contentContainerStyle={{
          // Search results have no header above them: keep the first day off the search bar.
          paddingTop: searching ? 14 : 0,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
        }}
        // Variable-height days (a day's line count, and which stacks are
        // open) mean there's no fixed `getItemLayout` to give FlatList —
        // this is the standard fallback: if a jump lands past what's been
        // measured yet, retry once the list has had a moment to lay out.
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
              <TransactionsHeadline
                periodKey={`${viewScope}-${anchor.toDateString()}`}
                direction={direction}
                expenseMinor={comparison?.current.expenseMinor ?? 0}
                incomeMinor={comparison?.current.incomeMinor ?? 0}
                expenseChangePct={expenseChangePct}
                viewScope={viewScope}
                compareLabel={viewScope === 'week' ? weekCompareLabel(week, today) : undefined}
                onChangeViewScope={onChangeViewScope}
                bars={bars}
                legend={legend}
                onPressDay={onPressBar}
                selectedKey={selectedBar}
                hint={barHint}
              />

              <ActivityFilterChips
                filterType={filterType}
                onFilterType={setFilterType}
                categoryIds={filterCategoryIds}
                accountIds={filterAccountIds}
                categoryName={categoryName}
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
