import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Animated, ActivityIndicator, TextInput } from 'react-native';
import ReanimatedAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useFocusEffect, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts, listCategories, listTransactions, searchTransactions } from '@/db/ledger';
import { getRangeComparison, PeriodComparison } from '@/db/reports';
import { Account, Category, Transaction, TransactionType } from '@/types';
import { SegmentedControl } from '@/components/SegmentedControl';
import { AppHeader, HeaderIconButton } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';
import { toLocalIsoDate, parseLocalIsoDate, addDaysToIsoDate, isoDatesInRange } from '@/lib/date';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { useSwipeStep } from '@/lib/useSwipeStep';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from '@/features/transactions/transactions.styles';
import { MONTH_NAMES } from '@/features/transactions/transactions.constants';
import { MonthPickerModal } from '@/features/transactions/MonthPickerModal';
import { FilterModal } from '@/features/transactions/FilterModal';
import { DayCard } from '@/features/transactions/DayCard';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { TransactionsHeadline } from '@/features/transactions/TransactionsHeadline';
import { TransactionsSkeleton } from '@/features/transactions/TransactionsSkeleton';
import { buildDailySpendBars, buildWeeklySpendBars, legendForBars } from '@/features/transactions/spendChart';

function isoDate(d: Date): string {
  return toLocalIsoDate(d);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A 7-day window ending on `anchor`, oldest first — `anchor` is a plain day
// step, not a week counter, so jumping straight to a chosen month (via the
// picker below) works the same way stepping by one day does. Only the
// metadata (for the "Sep 7 – 13" label) comes from this now — the day pills
// themselves were replaced by the spend chart, which is the actual way to
// jump to a day these days (tap a bar).
function sevenDaysEndingOn(
  anchor: Date
): { iso: string; weekday: string; day: number; month: number; year: number }[] {
  const days: { iso: string; weekday: string; day: number; month: number; year: number }[] = [];
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    days.push({
      iso: isoDate(d),
      weekday: labels[d.getDay()],
      day: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  return days;
}

/** The equivalent immediately-prior range, for the headline's "N% less/more than last …" line. */
function previousRangeFor(
  range: { fromDate: string; toDate: string },
  scope: 'week' | 'month'
): { fromDate: string; toDate: string } {
  if (scope === 'week') {
    const prevEnd = addDaysToIsoDate(range.fromDate, -1);
    const prevStart = addDaysToIsoDate(prevEnd, -6);
    return { fromDate: prevStart, toDate: prevEnd };
  }
  const start = parseLocalIsoDate(range.fromDate);
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
  return { fromDate: toLocalIsoDate(prevStart), toDate: toLocalIsoDate(prevEnd) };
}

/** Consecutive same-date runs — relies on `txs` already being date-sorted (the query's own ORDER BY), not a separate grouping pass over unsorted data. */
function groupByDate(txs: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const tx of txs) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }
  return groups;
}

const VIEW_SCOPES: { label: string; value: 'week' | 'month' }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

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
  const days = useMemo(() => sevenDaysEndingOn(anchor), [anchor]);
  const today = isoDate(todayDate);
  const isCurrentWeek = days.some((d) => d.iso === today);
  const isCurrentMonth =
    anchor.getFullYear() === todayDate.getFullYear() && anchor.getMonth() === todayDate.getMonth();
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<FlatList<{ date: string; items: Transaction[] }>>(null);
  // Which day-groups the user has tapped "+N more" on, kept here rather than
  // inside DayCard itself — DayCard is a row in the FlatList below, which
  // unmounts/remounts rows as they scroll off- and back on-screen, and local
  // state there would silently re-collapse a day the user had just expanded.
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  // Which way the headline/chart should slide on the next period change —
  // set alongside stepBack/stepForward/onPick/the scope toggle below, read
  // by TransactionsHeadline. 0 (a plain crossfade) for anything that isn't a
  // simple one-step move: picking an arbitrary month, or switching Week↔Month
  // itself, where a guessed slide direction wouldn't mean anything.
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);

  // Shared by the nav row's own chevron buttons and the swipe gesture below,
  // so stepping the period is one piece of logic instead of two copies.
  const stepBack = () => {
    setDirection(-1);
    setAnchor((a) => {
      if (viewScope === 'month') return new Date(a.getFullYear(), a.getMonth() - 1, 1);
      const d = new Date(a);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };
  const stepForward = () => {
    setDirection(1);
    setAnchor((a) => {
      const next =
        viewScope === 'month'
          ? new Date(a.getFullYear(), a.getMonth() + 1, 1)
          : (() => {
              const d = new Date(a);
              d.setDate(d.getDate() + 7);
              return d;
            })();
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
  const filterPress = usePressScale();

  const monthRange = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    return { fromDate: toLocalIsoDate(new Date(y, m, 1)), toDate: toLocalIsoDate(new Date(y, m + 1, 0)) };
  }, [anchor]);
  const visibleRange = viewScope === 'month' ? monthRange : { fromDate: days[0].iso, toDate: days[6].iso };
  const hasActiveFilter = filterType !== 'all' || filterCategoryIds.length > 0;
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategoryIds.length > 0) {
          if (!t.categoryId) return false;
          const cat = categories.find((c) => c.id === t.categoryId);
          // Selecting a parent (e.g. "Food & Dining") also matches its
          // subcategories ("Zomato", "Bistro Central") — otherwise picking
          // the parent chip would only ever surface transactions tagged
          // directly against it, which is narrower than what "Food &
          // Dining" means once it has children with spend rolled up to it
          // everywhere else (Reports).
          const matchesDirectly = filterCategoryIds.includes(t.categoryId);
          const matchesViaParent = !!cat?.parentId && filterCategoryIds.includes(cat.parentId);
          if (!matchesDirectly && !matchesViaParent) return false;
        }
        return true;
      }),
    [transactions, filterType, filterCategoryIds, categories]
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
        ? buildDailySpendBars(
            transactions,
            categories,
            isoDatesInRange(visibleRange.fromDate, visibleRange.toDate),
            today
          )
        : buildWeeklySpendBars(transactions, categories, visibleRange.fromDate, visibleRange.toDate, today),
    [transactions, categories, viewScope, visibleRange.fromDate, visibleRange.toDate, today]
  );
  const legend = useMemo(() => legendForBars(bars), [bars]);
  const groupedDays = useMemo(() => groupByDate(filteredTransactions), [filteredTransactions]);

  const load = useCallback(async (range: { fromDate: string; toDate: string }, scope: 'week' | 'month') => {
    try {
      const [tx, accs, cats] = await Promise.all([listTransactions(range), listAccounts(), listCategories()]);
      setTransactions(tx);
      setAccounts(accs);
      setCategories(cats);
      setLoadError(null);
    } catch (e: any) {
      // Previously unguarded — a transient DB failure left the screen
      // silently showing stale/empty data with no indication anything
      // went wrong, the same class of bug already fixed on the other tabs.
      setLoadError(String(e?.message ?? e));
    }
    // Fetched and caught separately from the list/accounts/categories above
    // — this only feeds the secondary "N% more/less than last …" headline
    // figure, so a failure here (or the comparison query being slower than
    // the rest) shouldn't blank the transaction list itself.
    try {
      const prev = previousRangeFor(range, scope);
      const cmp = await getRangeComparison(
        { start: range.fromDate, end: range.toDate },
        { start: prev.fromDate, end: prev.toDate },
        scope
      );
      setComparison(cmp);
    } catch {
      setComparison(null);
    }
  }, []);

  // Destructured so the focus effect depends on the primitive dates/scope,
  // not the fresh `visibleRange` object rebuilt every render (which would
  // re-run the load on every render).
  const { fromDate: rangeFromDate, toDate: rangeToDate } = visibleRange;
  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      setTodayDate((prev) => (isoDate(prev) === isoDate(now) ? prev : now));
      load({ fromDate: rangeFromDate, toDate: rangeToDate }, viewScope);
      // Coming back from the full add-transaction screen (edited or deleted
      // a row reached from a search result) — re-run the same query so the
      // list doesn't keep showing it exactly as it was before that edit.
      if (searching) runSearch(searchQuery.trim());
    }, [load, rangeFromDate, rangeToDate, viewScope, searching, searchQuery, runSearch])
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
  const trimmedQuery = searchQuery.trim();

  const onChangeViewScope = (scope: 'week' | 'month') => {
    setDirection(0);
    setViewScope(scope);
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

  // Before the first successful load (and only then — `loadError` set means
  // fall through to the normal render, which already shows an inline error
  // banner), a plain spinner beats letting "Nothing logged this month" flash
  // on screen before the real data has even arrived.
  if (!comparison && !loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="Transactions" />
        <TransactionsSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Transactions"
        right={
          <View style={styles.headerActions}>
            <HeaderIconButton
              icon="search"
              onPress={searching ? closeSearch : openSearch}
              label={searching ? 'Close search' : 'Search transactions'}
            />
            {!searching && (
              <AnimatedPressable
                onPress={() => setFilterVisible(true)}
                onPressIn={filterPress.onPressIn}
                onPressOut={filterPress.onPressOut}
                hitSlop={8}
                style={[styles.filterBtn, hasActiveFilter && styles.filterBtnActive, filterPress.animatedStyle]}
                accessibilityRole="button"
                accessibilityLabel="Filter transactions"
              >
                <Feather name="sliders" size={13} color={theme.colors.textPrimary} />
                <Text style={styles.filterBtnText}>Filter{hasActiveFilter ? ' •' : ''}</Text>
              </AnimatedPressable>
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
              placeholder="Search notes, categories, accounts…"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
              accessibilityLabel="Search transactions"
            />
          </View>
          <Pressable onPress={closeSearch} hitSlop={8}>
            <Text style={styles.searchCancel}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {!searching && (
        <View style={styles.scopeRow}>
          <SegmentedControl options={VIEW_SCOPES} value={viewScope} onChange={onChangeViewScope} />
        </View>
      )}

      {!searching && (
        <View style={styles.weekNavRow} {...weekNavSwipe.panHandlers}>
          <AnimatedPressable
            onPress={stepBack}
            onPressIn={stepBackPress.onPressIn}
            onPressOut={stepBackPress.onPressOut}
            hitSlop={10}
            style={[styles.weekNavBtn, stepBackPress.animatedStyle]}
          >
            <Text style={styles.weekNavArrow}>‹</Text>
          </AnimatedPressable>
          <Pressable onPress={() => setMonthPickerVisible(true)} hitSlop={6}>
            <ReanimatedAnimated.Text
              key={`${viewScope}-${anchor.toDateString()}`}
              entering={FadeIn.duration(150)}
              style={styles.weekNavLabel}
            >
              {viewScope === 'month'
                ? `${anchor.toLocaleDateString(undefined, { month: 'long' })}${isCurrentMonth ? '' : ` ${anchor.getFullYear()}`}`
                : isCurrentWeek
                  ? 'This week'
                  : `${MONTH_NAMES[days[0].month]} ${days[0].day}${days[0].year !== days[6].year || days[0].month !== days[6].month ? ` – ${MONTH_NAMES[days[6].month]} ${days[6].day}` : ` – ${days[6].day}`}, ${days[6].year}`}
              {'  ▾'}
            </ReanimatedAnimated.Text>
          </Pressable>
          <AnimatedPressable
            onPress={stepForward}
            onPressIn={stepForwardPress.onPressIn}
            onPressOut={stepForwardPress.onPressOut}
            hitSlop={10}
            disabled={viewScope === 'month' ? isCurrentMonth : isCurrentWeek}
            style={[styles.weekNavBtn, stepForwardPress.animatedStyle]}
          >
            <Text
              style={[
                styles.weekNavArrow,
                (viewScope === 'month' ? isCurrentMonth : isCurrentWeek) && styles.weekNavArrowDisabled,
              ]}
            >
              ›
            </Text>
          </AnimatedPressable>
        </View>
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
        type={filterType}
        categoryIds={filterCategoryIds}
        onClose={() => setFilterVisible(false)}
        onApply={(type, categoryIds) => {
          setFilterType(type);
          setFilterCategoryIds(categoryIds);
          setFilterVisible(false);
        }}
      />

      <FlatList
        ref={scrollRef}
        data={displayedGroups}
        keyExtractor={(group) => group.date}
        contentContainerStyle={{ paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom }}
        // Variable-height cards (a day's row count, and whether it's
        // expanded) mean there's no fixed `getItemLayout` to give FlatList —
        // this is the standard fallback: if a jump lands past what's been
        // measured yet, retry once the list has had a moment to lay out.
        onScrollToIndexFailed={(info) => {
          setTimeout(() => scrollRef.current?.scrollToIndex({ index: info.index, animated: true }), 250);
        }}
        ListHeaderComponent={
          searching ? (
            <>
              {trimmedQuery.length < SEARCH_MIN_CHARS ? (
                <EmptyState
                  title="Search your transactions"
                  subtitle="Matches notes, categories, and accounts — across your whole history, not just this week or month."
                />
              ) : searchLoading ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator color={theme.colors.ink} />
                </View>
              ) : searchResults.length === 0 ? (
                <EmptyState
                  title={`No matches for "${trimmedQuery}"`}
                  subtitle="Try a shorter word, or check the spelling — search looks at each transaction's note, category, and account."
                />
              ) : null}
            </>
          ) : (
            <>
              <TransactionsHeadline
                periodKey={`${viewScope}-${anchor.toDateString()}`}
                direction={direction}
                expenseMinor={comparison?.current.expenseMinor ?? 0}
                expenseChangePct={expenseChangePct}
                viewScope={viewScope}
                bars={bars}
                legend={legend}
                onPressDay={scrollToDay}
              />

              {accounts.length === 0 && (
                <Text style={styles.emptyText}>Add an account first before recording transactions.</Text>
              )}
              {accounts.length > 0 && transactions.length > 0 && filteredTransactions.length === 0 && (
                <Text style={styles.emptyText}>Nothing matches the current filter.</Text>
              )}
              {accounts.length > 0 && transactions.length === 0 && (
                <Text style={styles.emptyText}>
                  {viewScope === 'month' ? 'Nothing logged this month.' : 'Nothing logged this week.'}
                </Text>
              )}
            </>
          )
        }
        renderItem={({ item: group, index: gi }) => (
          <DayCard
            label={
              group.date === today
                ? 'Today'
                : searching
                  ? parseLocalIsoDate(group.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : parseLocalIsoDate(group.date).toLocaleDateString(undefined, { weekday: 'long' })
            }
            dateLabel={
              searching && group.date !== today
                ? String(parseLocalIsoDate(group.date).getFullYear())
                : parseLocalIsoDate(group.date)
                    .toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                    .toUpperCase()
            }
            items={group.items}
            categories={categories}
            accountName={accountName}
            categoryName={categoryName}
            onPressTx={setDetailTx}
            expanded={expandedDays.has(group.date)}
            onExpand={() =>
              setExpandedDays((prev) => {
                const next = new Set(prev);
                next.add(group.date);
                return next;
              })
            }
            entering={FadeIn.delay(Math.min(gi * 45, MAX_LIST_STAGGER_MS))
              .duration(280)
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
