import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { HeaderSummary } from '@/features/home/SkyHeader';
import { formatMoney } from '@/lib/money';
import { Text } from '@/components/Text';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getRangeComparison,
  PeriodComparison,
  findTopGrowingCategory,
  getMonthlyExpenseTrend,
  getNetWorthTrend,
  getMonthlyCashFlow,
  getCategoryMonthlyTotals,
  CashFlowPoint,
  CategoryTrack,
  getDailyExpenseTotals,
  getSubcategoryBreakdown,
  getLargestExpenses,
  getAccountBreakdown,
  LargestExpense,
  AccountBreakdownItem,
  TrendPoint,
  NetWorthPoint,
  DailyExpensePoint,
  CategoryBreakdownItem,
} from '@/db/reports';
import { listTransactions, listCategories, listAccounts } from '@/db/ledger';
import { usePrivacy } from '@/theme/PrivacyContext';
import { savingsAccountIdsOf } from '@/lib/account';
import { isSavingsEntry, privateComparison } from '@/lib/privateSummary';
import { Transaction, Category } from '@/types';
import { roundedMinor } from '@/lib/round';
import {
  CURRENT_PERIOD,
  ReportWindow,
  isCustomWindow,
  windowLabel,
  windowRange,
  previousWindowRange,
  previousPeriodLabel,
  rangeDays,
} from '@/lib/period';
import { findStartingBalances } from '@/db/tidyUp';
import { useFreshness } from '@/lib/useFreshness';
import { SegmentedControl } from '@/components/SegmentedControl';
import { parseLocalIsoDate, toLocalIsoDate, isIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { ReportsSkeleton } from '@/features/reports/ReportsSkeleton';
import { ReportsHeader } from '@/features/reports/ReportsHeader';
import { ReportSummary } from '@/features/reports/ReportSummary';
import { HeatmapCard } from '@/features/reports/HeatmapCard';
import { DayCard } from '@/features/reports/DayCard';
import { StoryCards } from '@/features/reports/StoryCards';
import { CategoryBar } from '@/features/reports/CategoryBar';
import { CategoryList } from '@/features/reports/CategoryList';
import { WeekdayRhythm } from '@/features/reports/WeekdayRhythm';
import { BiggestSpends } from '@/features/reports/BiggestSpends';
import { TrendChart, MIN_TREND_POINTS } from '@/features/reports/TrendChart';
import { CashFlowCard } from '@/features/reports/CashFlowCard';
import { CategoryTracks } from '@/features/reports/CategoryTracks';
import { styles } from '@/features/reports/reports.styles';
import {
  buildHeatGrid,
  buildRangeHeatGrid,
  RANGE_DAY_GRID_MAX_DAYS,
  baselineFromTrend,
  recurringVsDiscretionary,
  categoryDeltas,
  patternFacts,
  quietDays,
  buildStoryCards,
  vsUsual,
  daySpendFacts,
  weekdayRhythm,
  accountRows,
  categoriesAgainstUsual,
  StoryAction,
} from '@/features/reports/reportsInsights';
import { errorMessage } from '@/lib/errorMessage';
import { growHref } from '@/lib/cardGrow';
import { withPressed } from '@/lib/pressed';
import { EmptyState } from '@/components/EmptyState';

type ReportTab = 'days' | 'cats' | 'trends';
const TAB_OPTIONS: { value: ReportTab; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'cats', label: 'Categories' },
  { value: 'trends', label: 'Trends' },
];
type CategoryGroup = 'category' | 'account';
const GROUP_OPTIONS: { value: CategoryGroup; label: string }[] = [
  { value: 'category', label: 'By category' },
  { value: 'account', label: 'By account' },
];
/** How many single expenses "Biggest spends" lists. */
const BIGGEST_COUNT = 5;
/** Rows shown before "N more" in Categories (CategoryList's own limit). */
const CATEGORIES_COLLAPSED = 5;

export default function ReportsScreen() {
  const { hideAmounts } = usePrivacy();
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState<ReportWindow>(CURRENT_PERIOD);
  // Which way the last arrow or swipe moved, so the headline slides in from that side.
  const [slideDirection, setSlideDirection] = useState<-1 | 0 | 1>(0);
  const stepCursor = (next: ReportWindow) => {
    setSlideDirection(
      !isCustomWindow(next) && !isCustomWindow(cursor) && next.granularity === cursor.granularity
        ? (Math.sign(next.offset - cursor.offset) as -1 | 0 | 1)
        : 0
    );
    setCursor(next);
  };
  // "Where it went" (spending) or "Where it came from" (income).
  const [flow, setFlow] = useState<'expense' | 'income'>('expense');
  // Days, Categories or Trends: one lens at a time under the pinned summary.
  const [tab, setTab] = useState<ReportTab>('days');
  // Categories Tidy up reads as starting balances logged as income: the
  // Income view points at Tidy up when one of them makes up most of it.
  const [startingBalanceNames, setStartingBalanceNames] = useState<string[]>([]);
  // `?month=-1` opens a month (0 = this, -1 = last); `?from=&to=` (YYYY-MM-DD) opens that range. The tab
  // may already be mounted, so react to each new link, then clear the param.
  const {
    month: monthParam,
    from: fromParam,
    to: toParam,
  } = useLocalSearchParams<{
    month?: string;
    from?: string;
    to?: string;
  }>();
  useEffect(() => {
    if (monthParam == null) return;
    const offset = Number(monthParam);
    if (Number.isInteger(offset) && offset <= 0 && offset >= -120) {
      setCursor({ granularity: 'month', offset });
    }
    router.setParams({ month: undefined });
  }, [monthParam]);
  useEffect(() => {
    if (fromParam == null && toParam == null) return;
    if (isIsoDate(fromParam) && isIsoDate(toParam) && fromParam <= toParam) {
      setCursor({ granularity: 'custom', start: fromParam, end: toParam });
    }
    router.setParams({ from: undefined, to: undefined });
  }, [fromParam, toParam]);
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);

  // The heatmap day open under the grid, and its entries (null while loading).
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayData, setDayData] = useState<{ iso: string; txs: Transaction[] } | null>(null);
  // A category the heatmap is narrowed to, with its daily totals; the id says which category they belong
  // to, so a stale set is never shown for another.
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [filtered, setFiltered] = useState<{ id: string; daily: DailyExpensePoint[] } | null>(null);
  // The category row opened in Categories, with its subcategory split.
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [split, setSplit] = useState<{ id: string; items: CategoryBreakdownItem[] } | null>(null);
  // Categories grouped by category (the default) or by account, with the account row opened.
  const [group, setGroup] = useState<CategoryGroup>('category');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  // Fetched results carry the key they were fetched for, so one for another
  // period, flow or filter is never shown in place of the current one.
  const [accounts, setAccounts] = useState<{ key: string; items: AccountBreakdownItem[] } | null>(null);
  const [largest, setLargest] = useState<{ key: string; items: LargestExpense[] } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // "Where it went" shows the top 5 categories by default like every long list; reset on period change so a
  // stale month's expanded list never carries over.
  const [catExpanded, setCatExpanded] = useState(false);

  // The header shrinks as the report scrolls; the summary and tabs scroll with it.
  const { collapse, headerHeight, scrollHandler, scrollRef, resetScroll } = useCollapsingHeader();

  // Only the most recent load may write state — stepping periods quickly
  // starts overlapping loads, and an earlier one can finish last.
  const loadSeq = useRef(0);
  const load = useCallback(
    async (c: ReportWindow) => {
      const seq = ++loadSeq.current;
      setCatExpanded(false);
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
        setStatus((s) => (s === 'ready' ? s : 'loading'));
        const [cmp, tr, nw, cf, ct, dy, cats, tidy, accs] = await Promise.all([
          getRangeComparison(range, previousWindowRange(c), isCustomWindow(c) ? 'month' : c.granularity),
          getMonthlyExpenseTrend(trendMonths, anchor, hideAmounts),
          getNetWorthTrend(trendMonths, anchor),
          getMonthlyCashFlow(trendMonths, anchor, hideAmounts),
          getCategoryMonthlyTotals(trendMonths, anchor, hideAmounts),
          getDailyExpenseTotals(range, hideAmounts),
          listCategories(),
          // Only the starting-balance names (to word an insight); not Tidy up's whole-ledger repeat scan.
          findStartingBalances().catch(() => null),
          listAccounts(),
        ]);
        if (seq !== loadSeq.current) return false;
        setComparison(cmp);
        setTrend(tr);
        // Net worth counts every account, savings included, so it goes while savings are hidden.
        setNetWorthTrend(hideAmounts && accs.some((a) => a.type === 'savings') ? [] : nw);
        setCashFlow(cf);
        setCatTracks(ct);
        setSavingsIds(savingsAccountIdsOf(accs));
        setDaily(dy);
        setCategories(cats);
        setStartingBalanceNames(tidy ? tidy.map((g) => g.categoryName) : []);
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
  useFocusEffect(
    useCallback(() => {
      if (freshness.isFresh([load, cursor])) return;
      const started = freshness.start([load, cursor]);
      void load(cursor).then((ok) => {
        if (ok) freshness.commit(started);
      });
    }, [load, cursor, freshness])
  );

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // The heatmap leaves savings and investments out while they're hidden, so the day it opens does too.
  const openDay = useCallback(
    async (iso: string) => {
      setSelectedDay(iso);
      const txs = await listTransactions({ fromDate: iso, toDate: iso });
      setDayData({
        iso,
        txs: hideAmounts ? txs.filter((tx) => !isSavingsEntry(tx, catById, savingsIds)) : txs,
      });
    },
    [hideAmounts, catById, savingsIds]
  );
  const closeDay = useCallback(() => {
    setSelectedDay(null);
  }, []);

  // A new period starts clean: no day open, no filter, no category picked.
  const cursorKey = isCustomWindow(cursor)
    ? `${cursor.start}|${cursor.end}`
    : `${cursor.granularity}:${cursor.offset}`;
  useEffect(() => {
    closeDay();
    setCatFilter(null);
    setSelectedCat(null);
    setSelectedAccount(null);
  }, [cursorKey, closeDay]);

  // The filtered heatmap's days, reloaded with each fresh load of the period (`daily`).
  useEffect(() => {
    if (catFilter == null) return;
    let live = true;
    getDailyExpenseTotals(windowRange(cursor), hideAmounts, catFilter)
      .then((d) => live && setFiltered({ id: catFilter, daily: d }))
      .catch(() => live && setFiltered({ id: catFilter, daily: [] }));
    return () => {
      live = false;
    };
  }, [catFilter, cursor, hideAmounts, daily]);

  // The picked category's subcategories.
  useEffect(() => {
    if (selectedCat == null) return;
    let live = true;
    getSubcategoryBreakdown(selectedCat, windowRange(cursor), flow)
      .then((items) => live && setSplit({ id: selectedCat, items }))
      .catch(() => live && setSplit({ id: selectedCat, items: [] }));
    return () => {
      live = false;
    };
  }, [selectedCat, cursor, flow, daily]);

  // Where the period's spending (or income) went, by account.
  const accountsKey = `${cursorKey}|${flow}|${hideAmounts}`;
  useEffect(() => {
    if (group !== 'account') return;
    let live = true;
    getAccountBreakdown(windowRange(cursor), flow, hideAmounts)
      .then((items) => live && setAccounts({ key: accountsKey, items }))
      .catch(() => live && setAccounts({ key: accountsKey, items: [] }));
    return () => {
      live = false;
    };
  }, [group, cursor, flow, hideAmounts, accountsKey, daily]);

  // The period's biggest single expenses, up to today (entries logged ahead aren't spent yet).
  const largestKey = `${cursorKey}|${hideAmounts}|${catFilter ?? ''}`;
  useEffect(() => {
    let live = true;
    const r = windowRange(cursor);
    const today = toLocalIsoDate(new Date());
    getLargestExpenses(
      { start: r.start, end: r.end < today ? r.end : today },
      BIGGEST_COUNT,
      hideAmounts,
      catFilter ?? undefined
    )
      .then((items) => live && setLargest({ key: largestKey, items }))
      .catch(() => live && setLargest({ key: largestKey, items: [] }));
    return () => {
      live = false;
    };
  }, [cursor, hideAmounts, catFilter, largestKey, daily]);

  // A tab switch remounts the list at its top, so the header opens again with it.
  useEffect(() => resetScroll(), [tab, resetScroll]);

  // While loading or on an error, a plain header; the report's own one shrinks as it scrolls.
  const header = <ReportsHeader cursor={cursor} onChange={stepCursor} />;

  if (status === 'error') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errTitle}>Couldn&rsquo;t build your report</Text>
          <Text style={styles.errDetail}>{errorText}</Text>
        </View>
      </View>
    );
  }
  if (!comparison) {
    return (
      <View style={styles.container}>
        {header}
        <ReportsSkeleton />
      </View>
    );
  }

  const { current, previous } = comparison;
  const periodName = windowLabel(cursor);
  const custom = isCustomWindow(cursor);
  const dispExpense = roundedMinor(current.expenseMinor);
  const hasSpend = current.expenseMinor > 0;
  // A period with money in but nothing spent still has an Income breakdown and Trends to show.
  const hasData = hasSpend || current.incomeMinor > 0;

  const range = windowRange(cursor);
  const rangeStart = parseLocalIsoDate(range.start);
  const rangeEnd = parseLocalIsoDate(range.end);
  const daysInPeriod = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;

  const baseline = baselineFromTrend(trend);
  const todayIso = toLocalIsoDate(new Date());
  const monthInProgress = cursor.granularity === 'month' && cursor.offset === 0;
  const usual = vsUsual({
    spentMinor: current.expenseMinor,
    baselineMinor: baseline,
    granularity: custom ? 'custom' : cursor.granularity,
    inProgress: monthInProgress,
    todayIso,
  });
  // Spending dated after today is in the total but not in the days so far.
  const facts = daySpendFacts(daily, range, todayIso, dispExpense);
  const { recurringMinor, discretionaryMinor } = recurringVsDiscretionary(current.categoryBreakdown);
  const topGrowing = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);
  const isYear = cursor.granularity === 'year';
  // A long custom range reads like a year: by month, with no daily patterns.
  const byMonth = isYear || (custom && daysInPeriod > RANGE_DAY_GRID_MAX_DAYS);
  const quiet = quietDays(daily, range, todayIso);

  // The period "in short" as story cards (see buildStoryCards). The daily
  // pattern reads describe a month's shape, so a year view gets none.
  const stories = buildStoryCards({
    mover: topGrowing
      ? {
          categoryId: topGrowing.categoryId,
          name: topGrowing.name,
          pctChange: topGrowing.pctChange,
          totalMinor:
            current.categoryBreakdown.find((c) => c.categoryId === topGrowing.categoryId)?.totalMinor ?? 0,
        }
      : null,
    comparisonLabel: isCustomWindow(cursor) ? 'the period before' : previousPeriodLabel(cursor),
    patterns: byMonth ? [] : patternFacts(daily, daysInPeriod, range, todayIso),
    recurringMinor,
    discretionaryMinor,
    quiet,
    spendDays: facts.spendDays,
    isCurrentPeriod: isCustomWindow(cursor) ? range.end >= todayIso : cursor.offset === 0,
    unit: custom ? 'period' : isYear ? 'year' : 'month',
  });
  const income = flow === 'income';
  const shownBreakdown = income ? current.incomeBreakdown : current.categoryBreakdown;
  // The rows' own sum, not the period's spending: a category whose refunds outweigh its spending has no row
  // but still lowers that total, and the rows (whose rounded amounts and shares are made to add up to this)
  // would each be shaved to fit.
  const shownTotal = roundedMinor(shownBreakdown.reduce((sum, c) => sum + c.totalMinor, 0));
  const deltas = income
    ? categoryDeltas(current.incomeBreakdown, previous.incomeBreakdown)
    : categoryDeltas(current.categoryBreakdown, previous.categoryBreakdown);
  // A starting balance logged as income, making up over half of it: worth tidying.
  const startingHeavy = income
    ? current.incomeBreakdown.find(
        (c) => startingBalanceNames.includes(c.name) && c.totalMinor * 2 > current.incomeMinor
      )
    : undefined;
  // By account: the same bar and rows, one per account; an opened account lists its top categories.
  const accountItems = accounts?.key === accountsKey ? accounts.items : null;
  const byAccount = group === 'account';
  const accountBreakdown = accountItems ? accountRows(accountItems) : [];
  const accountTotal = roundedMinor(accountBreakdown.reduce((sum, a) => sum + a.totalMinor, 0));
  const accountSplit = accountItems?.find((a) => a.accountId === selectedAccount)?.topCategories ?? [];
  // An account opens Activity on the month; other periods have no single Activity view to land on.
  const onPressAccount =
    !custom && cursor.granularity === 'month'
      ? (a: CategoryBreakdownItem) =>
          router.navigate(`/transactions?account=${a.categoryId}&month=${range.start.slice(0, 7)}`)
      : undefined;
  // A category opens its own page (app/category/[id].tsx), on this same period.
  const openCategory = (categoryId: string, grow = false) => {
    const href = isCustomWindow(cursor)
      ? `/category/${categoryId}?g=custom&from=${cursor.start}&to=${cursor.end}`
      : `/category/${categoryId}?g=${cursor.granularity}&o=${cursor.offset}`;
    router.push(grow ? growHref(href) : href);
  };
  const onPressCategory = (c: CategoryBreakdownItem) => openCategory(c.categoryId);

  // The heatmap is narrowed to a category's days only where it has days at all.
  const filterId = byMonth ? null : catFilter;
  const filterCat = filterId ? catById.get(filterId) : undefined;
  const heatDaily = filterId ? (filtered?.id === filterId ? filtered.daily : []) : daily;
  const onTapDay = (iso: string) => (iso === selectedDay ? closeDay() : openDay(iso));
  const heatGrid = custom
    ? buildRangeHeatGrid({
        start: range.start,
        end: range.end,
        daily: heatDaily,
        onDayPress: onTapDay,
        selectedIso: selectedDay,
      })
    : buildHeatGrid({
        granularity: cursor.granularity,
        start: rangeStart,
        trend,
        daily: heatDaily,
        onDayPress: onTapDay,
        selectedIso: selectedDay,
      });
  // With a category filter on, the day lists that category's entries (and its subcategories').
  const inFilter = (tx: Transaction) =>
    tx.categoryId != null &&
    (tx.categoryId === filterId || catById.get(tx.categoryId)?.parentId === filterId);
  // Entries that arrive for a day other than the open one are never shown.
  const dayTx = dayData?.iso === selectedDay ? dayData.txs : null;
  const shownDayTx = dayTx && filterId ? dayTx.filter(inFilter) : dayTx;

  const showCategoryDays = (c: CategoryBreakdownItem) => {
    closeDay();
    setCatFilter(c.categoryId);
    setFiltered(null);
    setTab('days');
  };
  const pickCategory = (id: string) => {
    setSelectedCat(id);
    if (current.categoryBreakdown.findIndex((c) => c.categoryId === id) >= CATEGORIES_COLLAPSED) {
      setCatExpanded(true);
    }
  };
  // What "Biggest spends" is measured against: the period's spending up to today, or that of the narrowed category.
  const biggestShareOf = filterId
    ? heatDaily.filter((d) => d.date <= todayIso).reduce((sum, d) => sum + d.totalMinor, 0)
    : Math.max(0, dispExpense - facts.laterMinor);
  const showBiggestDay = (iso: string) => {
    openDay(iso);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const onStoryAction = (a: StoryAction) => {
    if (a.type === 'day') {
      setCatFilter(null);
      openDay(a.iso);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setTab('cats');
    setFlow('expense');
    if (a.type === 'category') pickCategory(a.id);
    else setSelectedCat(null);
  };

  // A point on the trend chart stands for a month: this opens Reports on it.
  const monthLink = custom
    ? undefined
    : (index: number, count: number) => {
        const [endY, endM] = range.end.split('-').map(Number);
        const now = new Date();
        const monthIdx = endY * 12 + (endM - 1) - (count - 1 - index);
        const offset = monthIdx - (now.getFullYear() * 12 + now.getMonth());
        if (offset > 0 || offset < -120) return null;
        if (cursor.granularity === 'month' && offset === cursor.offset) return null;
        const d = new Date(Math.floor(monthIdx / 12), monthIdx % 12, 1);
        return {
          name: d.toLocaleDateString(undefined, {
            month: 'long',
            ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }),
          }),
          open: () => stepCursor({ granularity: 'month', offset }),
        };
      };

  return (
    <View style={styles.container}>
      <ReanimatedAnimated.ScrollView
        key={tab}
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingHorizontal: 20,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
        }}
      >
        {hasData && (
          <View style={styles.bleed}>
            <ReportSummary
              periodName={periodName}
              slideDirection={slideDirection}
              spentMinor={dispExpense}
              vsUsualPct={usual?.pct ?? null}
              vsUsualSoFar={usual?.soFar ?? false}
              perDayMinor={facts.perDayMinor}
              spendDays={facts.spendDays}
              countedDays={facts.countedDays}
              laterMinor={facts.laterMinor}
            />
            <View style={styles.tabs}>
              <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
            </View>
          </View>
        )}
        {!hasData ? (
          <EmptyState
            title="Nothing spent in this period"
            subtitle="Use the arrows above to look back at a month with data."
          />
        ) : tab === 'days' && !hasSpend ? (
          <EmptyState
            title="Nothing spent in this period"
            subtitle="Money in is under Categories, and Trends shows the bigger picture."
          />
        ) : tab === 'days' ? (
          <>
            <HeatmapCard
              grid={heatGrid}
              isYear={byMonth}
              filter={
                filterCat
                  ? {
                      name: filterCat.name,
                      color: filterCat.color,
                      onClear: () => {
                        closeDay();
                        setCatFilter(null);
                      },
                    }
                  : null
              }
            />
            {!byMonth && selectedDay && (
              <DayCard iso={selectedDay} txs={shownDayTx} catById={catById} onClose={closeDay} />
            )}
            <StoryCards title={`${periodName}, in short`} cards={stories} onAction={onStoryAction} />
            {!byMonth && (
              <>
                <WeekdayRhythm
                  key={`${cursorKey}|${filterId ?? ''}`}
                  rhythm={weekdayRhythm(heatDaily, range, todayIso)}
                  scopeName={filterCat?.name}
                />
                <BiggestSpends
                  items={largest?.key === largestKey ? largest.items : []}
                  catById={catById}
                  shareOfMinor={biggestShareOf}
                  openIso={selectedDay}
                  onOpenDay={showBiggestDay}
                  inProgress={range.end >= todayIso}
                  scopeName={filterCat?.name}
                />
              </>
            )}
          </>
        ) : tab === 'cats' ? (
          <View>
            <Text style={styles.blockTitle}>{income ? 'Where it came from' : 'Where it went'}</Text>
            <SegmentedControl
              options={[
                { value: 'expense', label: 'Spending' },
                { value: 'income', label: 'Income' },
              ]}
              value={flow}
              onChange={(f) => {
                setFlow(f);
                setCatExpanded(false);
                setSelectedCat(null);
                setSelectedAccount(null);
              }}
            />
            <SegmentedControl
              options={GROUP_OPTIONS}
              value={group}
              onChange={(g) => {
                setGroup(g);
                setCatExpanded(false);
                setSelectedCat(null);
                setSelectedAccount(null);
              }}
            />
            {byAccount ? (
              accountItems === null ? (
                <ActivityIndicator color={theme.colors.ink} style={styles.daySpinner} />
              ) : accountBreakdown.length === 0 ? (
                <Text style={styles.empty}>
                  No {income ? 'income' : 'spending'} in {periodName}.
                </Text>
              ) : (
                <>
                  <CategoryBar breakdown={accountBreakdown} selectedId={selectedAccount} />
                  <CategoryList
                    breakdown={accountBreakdown}
                    spentMinor={accountTotal}
                    deltas={new Map()}
                    expanded={catExpanded}
                    onToggleExpanded={() => setCatExpanded((v) => !v)}
                    selectedId={selectedAccount}
                    onSelect={(a) => setSelectedAccount((id) => (id === a.categoryId ? null : a.categoryId))}
                    split={accountSplit}
                    splitCaption="Top categories"
                    onOpen={onPressAccount}
                    kind={flow}
                  />
                </>
              )
            ) : shownBreakdown.length === 0 ? (
              <Text style={styles.empty}>
                No {income ? 'income' : 'spending'} in {periodName}.
              </Text>
            ) : (
              <>
                <CategoryBar breakdown={shownBreakdown} selectedId={selectedCat} />
                <CategoryList
                  breakdown={shownBreakdown}
                  spentMinor={shownTotal}
                  deltas={deltas}
                  expanded={catExpanded}
                  onToggleExpanded={() => setCatExpanded((v) => !v)}
                  selectedId={selectedCat}
                  onSelect={(c) => setSelectedCat((id) => (id === c.categoryId ? null : c.categoryId))}
                  split={split?.id === selectedCat ? split.items : null}
                  onOpen={onPressCategory}
                  onShowDays={income || byMonth ? undefined : showCategoryDays}
                  kind={flow}
                />
              </>
            )}
            {startingHeavy && (
              <Pressable
                onPress={() => router.push('/tidy-up')}
                style={withPressed(styles.tidyNudge)}
                accessibilityRole="button"
              >
                <Text style={styles.tidyNudgeText}>
                  {startingHeavy.name} is over half of this income, and looks like starting balances.{' '}
                  <Text style={styles.tidyNudgeLink}>Tidy up</Text>
                </Text>
              </Pressable>
            )}
          </View>
        ) : trend.length >= MIN_TREND_POINTS || netWorthTrend.length >= MIN_TREND_POINTS ? (
          <>
            <TrendChart
              key={cursorKey}
              periodName={periodName}
              spentMinor={current.expenseMinor}
              trend={trend}
              baseline={baseline}
              inProgress={monthInProgress}
              netWorthTrend={netWorthTrend}
              monthLink={monthLink}
            />
            <CashFlowCard
              key={`flow-${cursorKey}`}
              points={cashFlow}
              inProgress={monthInProgress}
              monthLink={monthLink}
            />
            <CategoryTracks
              rows={categoriesAgainstUsual(catTracks)}
              catById={catById}
              inProgress={monthInProgress}
              onOpen={(id) => openCategory(id, true)}
            />
          </>
        ) : (
          <EmptyState
            title="Not enough history yet"
            subtitle="Trends show up once there are a few months of entries."
          />
        )}
      </ReanimatedAnimated.ScrollView>
      <ReportsHeader
        cursor={cursor}
        onChange={stepCursor}
        collapse={collapse}
        summary={
          hasData ? (
            <HeaderSummary figure={formatMoney(dispExpense)} rest="spent" dot={theme.colors.slice.spent} />
          ) : undefined
        }
        onChipPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </View>
  );
}
