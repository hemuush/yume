import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { DURATIONS } from '@/lib/motionTimings';
import { useLocalDayRefresh } from '@/lib/useLocalDayRefresh';
import { ExpenseLabelsReport } from '@/features/reports/ExpenseLabelsReport';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, ActivityIndicator, ScrollView, ScrollViewInstance } from 'react-native';
import { getCachedCurrency } from '@/db/settings';
import { Text } from '@/components/Text';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PrimaryButton } from '@/components/PrimaryButton';
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
import { listBudgetsForMonth } from '@/db/budgets';
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
import { ModalSheet } from '@/components/ModalSheet';
import { Amount } from '@/components/Amount';
import {
  ReportTabs,
  FlowSwitch,
  GroupPicker,
  ComparisonNote,
  type ReportTab,
} from '@/features/reports/ReportControls';
import { parseLocalIsoDate, toLocalIsoDate, isIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { useTabScrollPad } from '@/lib/uiScale';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { ReportsSkeleton } from '@/features/reports/ReportsSkeleton';
import { ReportsHeader } from '@/features/reports/ReportsHeader';
import { HeatmapCard, HeatScope } from '@/features/reports/HeatmapCard';
import { DayInspector } from '@/features/reports/DayInspector';
import { ReportHero } from '@/features/reports/ReportHero';
import { DayCard } from '@/features/reports/DayCard';
import { ReportInsights } from '@/features/reports/ReportInsights';
import { CategoryBar } from '@/features/reports/CategoryBar';
import { CategoryList } from '@/features/reports/CategoryList';
import { BiggestSpends } from '@/features/reports/BiggestSpends';
import { ReportTrends } from '@/features/reports/ReportTrends';
import { MIN_TREND_POINTS } from '@/features/reports/TrendChart';
import { CategoryTracks } from '@/features/reports/CategoryTracks';
import { styles } from '@/features/reports/reports.styles';
import {
  buildHeat,
  RANGE_DAY_GRID_MAX_DAYS,
  baselineFromTrend,
  recurringVsDiscretionary,
  categoryDeltas,
  patternFacts,
  quietDays,
  buildStoryCards,
  daySpendFacts,
  accountRows,
  categoriesAgainstUsual,
  StoryAction,
} from '@/features/reports/reportsInsights';
import { errorMessage } from '@/lib/errorMessage';
import { growHref } from '@/lib/cardGrow';
import { withPressed } from '@/lib/pressed';
import { EmptyState } from '@/components/EmptyState';
import { useTabScrollToTop } from '@/lib/useTabScrollToTop';
import { useReduceMotion } from '@/lib/useReduceMotion';
type CategoryGroup = 'category' | 'account';
/** How many single expenses "Biggest spends" lists. */
const BIGGEST_COUNT = 5;
/** Rows shown before "N more" in Categories (CategoryList's own limit). */
const CATEGORIES_COLLAPSED = 5;
/** How many categories get a chip on the heatmap. */
const HEAT_SCOPES = 4;
export default function ReportsScreen() {
  const reduceMotion = useReduceMotion();
  const { hideAmounts } = usePrivacy();
  const { accent, secondary } = useAccent();
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const [cursor, setCursor] = useState<ReportWindow>(CURRENT_PERIOD);
  const stepCursor = (next: ReportWindow) => setCursor(next);
  // "Where it went" (spending) or "Where it came from" (income).
  const [flow, setFlow] = useState<'expense' | 'income'>('expense');
  // Days, Categories or Trends: one lens at a time under the period control.
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
  // The period before, day by day (the hero's comparison line), and the month's total budget when there is one.
  const [budgetMinor, setBudgetMinor] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = `${JSON.stringify(cursor)}|${hideAmounts}`;
  const [detailRetry, setDetailRetry] = useState(0);
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const detailError = (key: string, message: string | null) =>
    setDetailErrors((old) => {
      const next = { ...old };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  const retryDetails = () => {
    setDetailErrors({});
    setDetailRetry((n) => n + 1);
  };
  // The heatmap day open under the grid, and its entries (null while loading).
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayData, setDayData] = useState<{ iso: string; txs: Transaction[] } | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const daySeq = useRef(0);
  // A category the heatmap is narrowed to, with its daily totals; the id says which category they belong
  // to, so a stale set is never shown for another.
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [filtered, setFiltered] = useState<{ id: string; daily: DailyExpensePoint[] } | null>(null);
  // The category row opened in Categories, with its subcategory split.
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [split, setSplit] = useState<{ id: string; items: CategoryBreakdownItem[] } | null>(null);
  // Categories grouped by category (the default) or by account, with the account row opened.
  const [labelsOpen, setLabelsOpen] = useState(false);
  useEffect(() => setLabelsOpen(false), [tab, cursor, flow]);
  const [group, setGroup] = useState<CategoryGroup>('category');
  // The split drawn as tiles (default) or as one bar.
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  // Fetched results carry the key they were fetched for, so one for another
  // period, flow or filter is never shown in place of the current one.
  const [accounts, setAccounts] = useState<{ key: string; items: AccountBreakdownItem[] } | null>(null);
  const [largest, setLargest] = useState<{ key: string; items: LargestExpense[] } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // "Where it went" shows the top 5 categories by default like every long list; reset on period change so a
  // stale month's expanded list never carries over.
  const [catExpanded, setCatExpanded] = useState(false);
  // Stable header and tabs are normal-flow siblings, so neither can cover content.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const resetScroll = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []);
  useTabScrollToTop(scrollRef);
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
                .then((list) => list.reduce((sum, b) => sum + b.effectiveLimitMinor, 0))
                .catch(() => 0)
            : Promise.resolve(0),
        ]);
        if (seq !== loadSeq.current) return false;
        const thisMonth = toLocalIsoDate(new Date()).slice(0, 7);
        setComparison(cmp);
        setLoadedKey(`${JSON.stringify(c)}|${hideAmounts}`);
        setTrend(
          tr.map((p, i) => ({
            ...p,
            totalMinor: cf[i]?.month === thisMonth ? cf[i].expenseMinor : p.totalMinor,
            recorded: cf[i]?.recorded,
            month: cf[i]?.month,
          }))
        );
        // Net worth counts every account, savings included, so it goes while savings are hidden.
        setNetWorthTrend(
          hideAmounts && accs.some((a) => a.type === 'savings')
            ? []
            : nw.map((p, i) => ({
                ...p,
                month: cf[i]?.month,
                recorded: !cf[i]?.month || cf[i].month! <= thisMonth,
              }))
        );
        setCashFlow(cf);
        const lastElapsed = cf.findLastIndex((p) => !p.month || p.month <= thisMonth);
        setCatTracks(ct.map((p) => ({ ...p, totalsMinor: p.totalsMinor.slice(0, lastElapsed + 1) })));
        setSavingsIds(savingsAccountIdsOf(accs));
        setDaily(dy);
        setBudgetMinor(bud > 0 ? bud : null);
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
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  // The day under the heatmap's inspector: the one touched last, else today (or the period's last day).
  const inspectIso = useMemo(() => {
    const r = windowRange(cursor);
    const t = toLocalIsoDate(new Date());
    return selectedDay ?? (r.end < t ? r.end : t);
  }, [cursor, selectedDay]);
  const [dayRetry, setDayRetry] = useState(0);
  // Its entries, read a moment after the finger settles. The heatmap leaves savings and investments out
  // while they're hidden, so the day does too.
  useEffect(() => {
    const seq = ++daySeq.current;
    setDayError(null);
    const timer = setTimeout(async () => {
      try {
        const txs = await listTransactions({
          fromDate: inspectIso,
          toDate: inspectIso,
          currency: getCachedCurrency(),
        });
        if (seq !== daySeq.current) return;
        setDayData({
          iso: inspectIso,
          txs: hideAmounts ? txs.filter((tx) => !isSavingsEntry(tx, catById, savingsIds)) : txs,
        });
      } catch (e) {
        if (seq === daySeq.current) setDayError(errorMessage(e));
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [inspectIso, hideAmounts, catById, savingsIds, dayRetry]);
  // Picking a day only inspects it; its sheet opens from the inspector (or a story / biggest spend).
  const inspectDay = useCallback((iso: string) => setSelectedDay(iso), []);
  const openDay = useCallback((iso: string) => {
    setSelectedDay(iso);
    setSheetOpen(true);
  }, []);
  const closeDay = useCallback(() => setSheetOpen(false), []);
  // A new period starts clean: no day open, no filter, no category picked.
  const cursorKey = isCustomWindow(cursor)
    ? `${cursor.start}|${cursor.end}`
    : `${cursor.granularity}:${cursor.offset}`;
  useEffect(() => {
    setSelectedDay(null);
    setSheetOpen(false);
    setCatFilter(null);
    setSelectedCat(null);
    setSelectedAccount(null);
  }, [cursorKey, hideAmounts]);
  useEffect(() => {
    setDetailErrors({});
  }, [cursorKey, hideAmounts, catFilter, selectedCat, flow, group]);
  useEffect(
    () => () => {
      ++loadSeq.current;
      ++daySeq.current;
    },
    []
  );
  // The filtered heatmap's days, reloaded with each fresh load of the period (`daily`).
  useEffect(() => {
    if (catFilter == null) return;
    let live = true;
    setFiltered(null);
    getDailyExpenseTotals(windowRange(cursor), hideAmounts, catFilter)
      .then((d) => live && setFiltered({ id: catFilter, daily: d }))
      .catch((e) => {
        if (live) detailError('heatmap', errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [catFilter, cursor, hideAmounts, daily, detailRetry]);
  // The picked category's subcategories.
  useEffect(() => {
    if (selectedCat == null) return;
    let live = true;
    setSplit(null);
    getSubcategoryBreakdown(selectedCat, windowRange(cursor), flow)
      .then((items) => live && setSplit({ id: selectedCat, items }))
      .catch((e) => {
        if (live) detailError('split', errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [selectedCat, cursor, flow, daily, detailRetry]);
  // Where the period's spending (or income) went, by account.
  const accountsKey = `${cursorKey}|${flow}|${hideAmounts}`;
  useEffect(() => {
    if (group !== 'account') return;
    let live = true;
    setAccounts(null);
    getAccountBreakdown(windowRange(cursor), flow, hideAmounts)
      .then((items) => live && setAccounts({ key: accountsKey, items }))
      .catch((e) => {
        if (live) detailError('accounts', errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [group, cursor, flow, hideAmounts, accountsKey, daily, detailRetry]);
  // The period's biggest single expenses, up to today (entries logged ahead aren't spent yet).
  const largestKey = `${cursorKey}|${hideAmounts}|${catFilter ?? ''}`;
  useEffect(() => {
    let live = true;
    setLargest(null);
    const r = windowRange(cursor);
    const today = toLocalIsoDate(new Date());
    getLargestExpenses(
      { start: r.start, end: r.end < today ? r.end : today },
      BIGGEST_COUNT,
      hideAmounts,
      catFilter ?? undefined
    )
      .then((items) => live && setLargest({ key: largestKey, items }))
      .catch((e) => {
        if (live) detailError('largest', errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [cursor, hideAmounts, catFilter, largestKey, daily, detailRetry]);
  // A different report view or period starts at the top.
  // A new sub-tab starts at the top. The scroll view itself stays mounted (remounting it on every tap rebuilt the
  // heatmap and charts and hitched), so the jump to the top is explicit.
  useEffect(() => {
    resetScroll();
  }, [tab, cursor, resetScroll, scrollRef]);
  // Use the same stable header in loading, error and ready states.
  const header = <ReportsHeader cursor={cursor} onChange={stepCursor} />;
  if (status === 'error' && (loadedKey !== requestKey || !comparison)) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} />
        {header}
        <ReportTabs value={tab} onChange={setTab} />
        <View style={styles.center}>
          <Text style={styles.errTitle}>Couldn&rsquo;t build your report</Text>
          <Text style={styles.errDetail}>{errorText}</Text>
          <PrimaryButton
            title="Try again"
            variant="secondary"
            onPress={() => void load(cursor)}
            style={styles.errRetry}
          />
        </View>
      </View>
    );
  }
  if (loadedKey !== requestKey || !comparison) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} />
        {header}
        <ReportTabs value={tab} onChange={setTab} />
        {/* The loading header is in normal flow and already reserves its height. */}
        <View>
          <ReportsSkeleton />
        </View>
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
  const historyInProgress =
    cashFlow.filter((p) => p.recorded !== false).at(-1)?.month === todayIso.slice(0, 7) || monthInProgress;
  // Spending dated after today is in the total but not in the days so far.
  const facts = daySpendFacts(daily, range, todayIso, dispExpense);
  const { recurringMinor, discretionaryMinor } = recurringVsDiscretionary(current.categoryBreakdown);
  const topGrowing = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);
  const isYear = cursor.granularity === 'year';
  // A long custom range reads like a year: by month, with no daily patterns.
  const byMonth = isYear || (custom && daysInPeriod > RANGE_DAY_GRID_MAX_DAYS);
  const quiet = quietDays(daily, range, todayIso);
  // The period "in short" as expandable insights (see buildStoryCards). The daily
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
  // The heatmap can be narrowed to one category, at any period length.
  const filterId = catFilter;
  const filterCat = filterId ? catById.get(filterId) : undefined;
  const filterLoading = filterId != null && filtered?.id !== filterId;
  const heatDaily = filterId ? (filtered?.id === filterId ? filtered.daily : []) : daily;
  const heat = buildHeat({ range, daily: heatDaily, today: todayIso });
  const usualMinor =
    facts.countedDays > 0
      ? filterId
        ? Math.round(
            heatDaily.filter((d) => d.date <= todayIso).reduce((sum, d) => sum + d.totalMinor, 0) /
              facts.countedDays
          )
        : facts.perDayMinor
      : 0;
  const heatScopes: HeatScope[] = [
    { id: null, name: 'All', color: accent },
    ...current.categoryBreakdown
      .slice(0, HEAT_SCOPES)
      .map((c) => ({ id: c.categoryId, name: c.name, color: c.color })),
  ];
  if (filterId && filterCat && !heatScopes.some((x) => x.id === filterId)) {
    heatScopes.push({ id: filterId, name: filterCat.name, color: filterCat.color });
  }
  const heatDays = heat.kind === 'calendar' ? heat.days : heat.rows.flatMap((r) => r.days);
  const inspected = heatDays.find((d) => d?.iso === inspectIso) ?? null;
  // With a category filter on, the day lists that category's entries (and its subcategories').
  const inFilter = (tx: Transaction) =>
    tx.categoryId != null &&
    (tx.categoryId === filterId || catById.get(tx.categoryId)?.parentId === filterId);
  // Entries that arrive for a day other than the open one are never shown.
  const dayTx = dayData?.iso === inspectIso ? dayData.txs : null;
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
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
  };
  const onStoryAction = (a: StoryAction) => {
    if (a.type === 'day') {
      setCatFilter(null);
      openDay(a.iso);
      scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
      return;
    }
    setTab('cats');
    setGroup('category');
    setFlow('expense');
    if (a.type === 'category') pickCategory(a.id);
    else setSelectedCat(null);
  };
  // A month row of the heatmap matrix opens Reports on that month.
  const openMonthOf = (monthKey: string) => {
    const [y, m] = monthKey.split('-').map(Number);
    const now = new Date();
    const offset = y * 12 + (m - 1) - (now.getFullYear() * 12 + now.getMonth());
    if (offset <= 0 && offset >= -120) stepCursor({ granularity: 'month', offset });
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
      <HomeWallpaper accent={accent} secondary={secondary} />
      {header}
      <ReportTabs value={tab} onChange={setTab} />
      <ScrollView
        ref={scrollRef}
        testID="reports-content"
        contentContainerStyle={{
          paddingTop: 18,
          paddingHorizontal: 16,
          paddingBottom: tabScrollPad + insets.bottom,
        }}
      >
        {status === 'error' && (
          <View style={styles.tidyNudge}>
            <Text style={styles.errTitle}>Couldn’t refresh your report</Text>
            <Text style={styles.errDetail}>{errorText}</Text>
            <PrimaryButton title="Retry" variant="secondary" onPress={() => void load(cursor)} />
          </View>
        )}
        {Object.keys(detailErrors).length > 0 && (
          <View style={styles.tidyNudge}>
            <Text style={styles.errTitle}>Some report details couldn’t load</Text>
            <Text style={styles.errDetail}>{Object.values(detailErrors).join('\n')}</Text>
            <PrimaryButton title="Retry details" variant="secondary" onPress={retryDetails} />
          </View>
        )}
        <Animated.View
          key={tab}
          entering={FadeIn.duration(DURATIONS.standard).reduceMotion(ReduceMotion.System)}
        >
          {tab === 'days' && !hasSpend ? (
            <EmptyState
              title="Nothing spent in this period"
              subtitle={
                hasData
                  ? 'Money in is under Breakdown, and Trends shows the bigger picture.'
                  : 'Use the arrows to look back, or open Trends for recorded history.'
              }
            />
          ) : tab === 'days' ? (
            <>
              <ReportHero
                animKey={cursorKey}
                periodName={periodName}
                inProgress={range.end >= todayIso}
                spentMinor={dispExpense}
                perDayMinor={facts.countedDays > 0 ? facts.perDayMinor : null}
                budgetMinor={budgetMinor}
                incomeMinor={current.incomeMinor}
                previousIncomeMinor={previous.incomeMinor}
                comparedTo={custom ? 'the period before' : previousPeriodLabel(cursor)}
              />
              <View style={filterLoading ? styles.dimmed : undefined}>
                <HeatmapCard
                  model={heat}
                  selectedIso={inspectIso}
                  onSelect={inspectDay}
                  onOpenMonth={custom && !byMonth ? undefined : openMonthOf}
                  usualMinor={usualMinor}
                  scopes={heatScopes}
                  scopeId={filterId}
                  onScope={(id) => {
                    setCatFilter(id);
                    setFiltered(null);
                  }}
                  hue={filterCat?.color ?? accent}
                >
                  {inspected && (
                    <DayInspector
                      iso={inspectIso}
                      spentMinor={inspected.minor}
                      future={inspected.future}
                      usualMinor={usualMinor}
                      scopeName={filterCat?.name}
                      txs={shownDayTx}
                      catById={catById}
                      onOpen={() => setSheetOpen(true)}
                    />
                  )}
                </HeatmapCard>
              </View>
              {sheetOpen && (
                <ModalSheet
                  visible
                  onClose={closeDay}
                  title={parseLocalIsoDate(inspectIso).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  })}
                  subtitle={
                    shownDayTx && shownDayTx.length > 0
                      ? `${shownDayTx.length} transaction${shownDayTx.length === 1 ? '' : 's'}`
                      : undefined
                  }
                >
                  <DayCard
                    embedded
                    iso={inspectIso}
                    txs={shownDayTx}
                    catById={catById}
                    onClose={closeDay}
                    error={dayError}
                    onRetry={() => setDayRetry((n) => n + 1)}
                  />
                </ModalSheet>
              )}

              <ReportInsights
                // A new period starts at the first card.
                key={`${range.start}:${range.end}`}
                title="Worth a look"
                cards={stories}
                onAction={onStoryAction}
              />
              {!byMonth && (!filterId || filtered?.id === filterId) && (
                <>
                  {!largest || largest.key !== largestKey ? (
                    !detailErrors.largest && (
                      <ActivityIndicator
                        accessibilityLabel="Loading biggest spends"
                        color={theme.colors.ink}
                        style={styles.daySpinner}
                      />
                    )
                  ) : (
                    <BiggestSpends
                      key={largestKey}
                      items={largest?.key === largestKey ? largest.items : []}
                      catById={catById}
                      shareOfMinor={biggestShareOf}
                      openIso={selectedDay}
                      onOpenDay={showBiggestDay}
                      inProgress={range.end >= todayIso}
                      scopeName={filterCat?.name}
                    />
                  )}
                </>
              )}
            </>
          ) : tab === 'cats' ? (
            <View>
              <FlowSwitch
                flow={flow}
                onFlow={(f) => {
                  setFlow(f);
                  setCatExpanded(false);
                  setSelectedCat(null);
                  setSelectedAccount(null);
                }}
              />
              <View style={styles.sumCard}>
                <View style={styles.sumHead}>
                  <Text style={styles.sumTitle}>{income ? 'Where it came from' : 'Where it went'}</Text>
                  <GroupPicker
                    flow={flow}
                    group={group}
                    onLabels={() => setLabelsOpen(true)}
                    onGroup={(g) => {
                      setGroup(g);
                      setCatExpanded(false);
                      setSelectedCat(null);
                      setSelectedAccount(null);
                    }}
                  />
                </View>
                {(byAccount ? accountItems !== null : shownBreakdown.length > 0) && (
                  <View style={styles.breakdownContext}>
                    <Amount minor={byAccount ? accountTotal : shownTotal} style={styles.breakdownAmount} />
                    <Text style={styles.stripSub}>
                      {income ? 'received' : 'spent'} · {periodName}
                      {range.end >= todayIso ? ' so far' : ''}
                    </Text>
                  </View>
                )}
                {byAccount
                  ? accountItems !== null &&
                    accountBreakdown.length > 0 && (
                      <CategoryBar breakdown={accountBreakdown} selectedId={selectedAccount} />
                    )
                  : shownBreakdown.length > 0 && (
                      <CategoryBar breakdown={shownBreakdown} selectedId={selectedCat} />
                    )}
                {!byAccount && shownBreakdown.length > 0 && (
                  <ComparisonNote
                    label={`${range.end >= todayIso ? 'So far vs full ' : 'Vs '}${custom ? 'previous period' : previousPeriodLabel(cursor)}`}
                    partial={range.end >= todayIso}
                  />
                )}
              </View>
              <ExpenseLabelsReport visible={labelsOpen} range={range} onClose={() => setLabelsOpen(false)} />
              {byAccount ? (
                detailErrors.accounts ? null : accountItems === null ? (
                  <ActivityIndicator color={theme.colors.ink} style={styles.daySpinner} />
                ) : accountBreakdown.length === 0 ? (
                  <Text style={styles.empty}>
                    No {income ? 'income' : 'spending'} in {periodName}.
                  </Text>
                ) : (
                  <>
                    <CategoryList
                      breakdown={accountBreakdown}
                      spentMinor={accountTotal}
                      deltas={new Map()}
                      expanded={catExpanded}
                      onToggleExpanded={() => setCatExpanded((v) => !v)}
                      selectedId={selectedAccount}
                      onSelect={(a) =>
                        setSelectedAccount((id) => (id === a.categoryId ? null : a.categoryId))
                      }
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
                  <CategoryList
                    breakdown={shownBreakdown}
                    spentMinor={shownTotal}
                    deltas={deltas}
                    splitError={detailErrors.split}
                    onRetrySplit={retryDetails}
                    expanded={catExpanded}
                    onToggleExpanded={() => setCatExpanded((v) => !v)}
                    currentRange={range}
                    previousRange={previousWindowRange(cursor)}
                    selectedId={selectedCat}
                    onSelect={(c) => setSelectedCat((id) => (id === c.categoryId ? null : c.categoryId))}
                    split={detailErrors.split ? [] : split?.id === selectedCat ? split.items : null}
                    onOpen={onPressCategory}
                    onShowDays={income ? undefined : showCategoryDays}
                    kind={flow}
                    iconOf={(id) => catById.get(id)?.icon}
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
              <ReportTrends
                cashFlow={cashFlow}
                key={cursorKey}
                periodName={periodName}
                spentMinor={current.expenseMinor}
                trend={trend}
                baseline={baseline}
                inProgress={monthInProgress}
                netWorthTrend={netWorthTrend}
                monthLink={monthLink}
                projectedMinor={
                  monthInProgress && facts.countedDays > 0
                    ? Math.round(facts.perDayMinor * daysInPeriod)
                    : null
                }
              />
              <CategoryTracks
                rows={categoriesAgainstUsual(catTracks)}
                catById={catById}
                inProgress={historyInProgress}
                onOpen={(id) => openCategory(id, true)}
              />
            </>
          ) : (
            <EmptyState
              title="Not enough history yet"
              subtitle="Trends show up once there are a few months of entries."
            />
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
