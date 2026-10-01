import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getRangeComparison,
  PeriodComparison,
  findTopGrowingCategory,
  getMonthlyExpenseTrend,
  getNetWorthTrend,
  getDailyExpenseTotals,
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
import { AppHeader } from '@/components/AppHeader';
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
import { getTidyUpReport } from '@/db/tidyUp';
import { SegmentedControl } from '@/components/SegmentedControl';
import { parseLocalIsoDate, toLocalIsoDate, isIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { ReportsSkeleton } from '@/features/reports/ReportsSkeleton';
import { PeriodRow } from '@/features/reports/PeriodRow';
import { HeatmapCard } from '@/features/reports/HeatmapCard';
import { StoryCards } from '@/features/reports/StoryCards';
import { CategoryMosaic } from '@/features/reports/CategoryMosaic';
import { CategoryList } from '@/features/reports/CategoryList';
import { TrendChart } from '@/features/reports/TrendChart';
import { DaySheet } from '@/features/reports/ReportSheets';
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
  StoryTarget,
} from '@/features/reports/reportsInsights';
import { errorMessage } from '@/lib/errorMessage';
import { withPressed } from '@/lib/pressed';
import { EmptyState } from '@/components/EmptyState';

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
  // Categories Tidy up reads as starting balances logged as income: the
  // Income view points at Tidy up when one of them makes up most of it.
  const [startingBalanceNames, setStartingBalanceNames] = useState<string[]>([]);
  // `/reports?month=-1` opens on a specific month (0 = this month, -1 = last
  // month) — used by Home's month-in-review card. Reports is a tab, so it may
  // already be mounted: this reacts to each new link, then clears the param
  // so a later visit to the tab isn't pulled back to that month.
  // `?from=YYYY-MM-DD&to=YYYY-MM-DD` opens on that range — the week Wrap's
  // "See the full report", for the week it just played.
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
  const [daily, setDaily] = useState<DailyExpensePoint[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);

  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [dayTx, setDayTx] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // "Where it went" shows the top 5 categories by default, like every other
  // long list in the app — reset whenever the period changes so switching
  // months never leaves a stale month's list expanded.
  const [catExpanded, setCatExpanded] = useState(false);

  // Where each section starts, for the story cards that jump to one —
  // filled in by each section's own onLayout, not measured up front, since
  // heights here depend on real data (how many categories, whether the
  // moon card even renders this period).
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  // react-hooks/refs misreads this: calling onSectionLayout(key) in render
  // only *builds* the onLayout handler — the ref is written inside it, when
  // layout fires, never during render.
  const onSectionLayout = (key: string) => (e: LayoutChangeEvent) => {
    // eslint-disable-next-line react-hooks/refs
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const jumpTo = (key: StoryTarget) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] ?? 0) - 8), animated: true });
  };

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
        const [cmp, tr, nw, dy, cats, tidy, accs] = await Promise.all([
          getRangeComparison(range, previousWindowRange(c), isCustomWindow(c) ? 'month' : c.granularity),
          getMonthlyExpenseTrend(trendMonths, anchor, hideAmounts),
          getNetWorthTrend(trendMonths, anchor),
          getDailyExpenseTotals(range, hideAmounts),
          listCategories(),
          getTidyUpReport().catch(() => null),
          listAccounts(),
        ]);
        if (seq !== loadSeq.current) return;
        setComparison(cmp);
        setTrend(tr);
        // Net worth counts every account, savings included, so it goes while savings are hidden.
        setNetWorthTrend(hideAmounts && accs.some((a) => a.type === 'savings') ? [] : nw);
        setSavingsIds(savingsAccountIdsOf(accs));
        setDaily(dy);
        setCategories(cats);
        setStartingBalanceNames(tidy ? tidy.startingBalances.map((g) => g.categoryName) : []);
        setStatus('ready');
        setErrorText(null);
      } catch (e) {
        if (seq !== loadSeq.current) return;
        setErrorText(errorMessage(e));
        setStatus('error');
      }
    },
    [hideAmounts]
  );

  useFocusEffect(
    useCallback(() => {
      load(cursor);
    }, [load, cursor])
  );

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // The heatmap leaves savings and investments out while they're hidden, so the day it opens does too.
  const openDay = useCallback(
    async (iso: string) => {
      setDaySheet(iso);
      setDayTx(null);
      const txs = await listTransactions({ fromDate: iso, toDate: iso });
      setDayTx(hideAmounts ? txs.filter((tx) => !isSavingsEntry(tx, catById, savingsIds)) : txs);
    },
    [hideAmounts, catById, savingsIds]
  );

  // Pinned outside the ScrollView, so the period stays in reach however far down you scroll.
  const header = (
    <>
      <AppHeader title="Reports" />
      <PeriodRow cursor={cursor} onChange={stepCursor} />
    </>
  );

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

  const range = windowRange(cursor);
  const rangeStart = parseLocalIsoDate(range.start);
  const rangeEnd = parseLocalIsoDate(range.end);
  const daysInPeriod = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;

  const baseline = baselineFromTrend(trend);
  // "Above usual" compares with a usual month, so a custom range doesn't get it.
  const vsUsualPct =
    !custom && baseline && baseline > 0 ? ((current.expenseMinor - baseline) / baseline) * 100 : null;
  const spendDays = daily.filter((d) => d.totalMinor > 0).length;
  const { recurringMinor, discretionaryMinor } = recurringVsDiscretionary(current.categoryBreakdown);
  const topGrowing = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);
  const isYear = cursor.granularity === 'year';
  // A long custom range reads like a year: by month, with no daily patterns.
  const byMonth = isYear || (custom && daysInPeriod > RANGE_DAY_GRID_MAX_DAYS);
  // Days counted so far — today, for the period in progress.
  const quiet = quietDays(daily, range, toLocalIsoDate(new Date()));
  const perDay = quiet.countedDays > 0 ? Math.round(dispExpense / quiet.countedDays) : 0;

  // The period "in short" as story cards (see buildStoryCards). The daily
  // pattern reads describe a month's shape, so a year view gets none.
  const stories = buildStoryCards({
    mover: topGrowing
      ? {
          name: topGrowing.name,
          pctChange: topGrowing.pctChange,
          totalMinor:
            current.categoryBreakdown.find((c) => c.categoryId === topGrowing.categoryId)?.totalMinor ?? 0,
        }
      : null,
    comparisonLabel: isCustomWindow(cursor) ? 'the period before' : previousPeriodLabel(cursor),
    patterns: byMonth ? [] : patternFacts(daily, daysInPeriod),
    recurringMinor,
    discretionaryMinor,
    quiet,
    spendDays,
    isCurrentPeriod: isCustomWindow(cursor) ? range.end >= toLocalIsoDate(new Date()) : cursor.offset === 0,
    unit: custom ? 'period' : isYear ? 'year' : 'month',
  });
  const income = flow === 'income';
  const shownBreakdown = income ? current.incomeBreakdown : current.categoryBreakdown;
  const shownTotal = income ? roundedMinor(current.incomeMinor) : dispExpense;
  const deltas = income
    ? categoryDeltas(current.incomeBreakdown, previous.incomeBreakdown)
    : categoryDeltas(current.categoryBreakdown, previous.categoryBreakdown);
  // A starting balance logged as income, making up over half of it: worth tidying.
  const startingHeavy = income
    ? current.incomeBreakdown.find(
        (c) => startingBalanceNames.includes(c.name) && c.totalMinor * 2 > current.incomeMinor
      )
    : undefined;
  // A category opens its own page (app/category/[id].tsx), on this same period.
  const onPressCategory = (c: CategoryBreakdownItem) =>
    router.push(
      isCustomWindow(cursor)
        ? `/category/${c.categoryId}?g=custom&from=${cursor.start}&to=${cursor.end}`
        : `/category/${c.categoryId}?g=${cursor.granularity}&o=${cursor.offset}`
    );

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
        }}
      >
        {!hasSpend ? (
          <EmptyState
            title="Nothing spent in this period"
            subtitle="Use the arrows above to look back at a month with data."
          />
        ) : (
          <>
            {/* Overview: the heatmap on top (with the headline in it), then the period in short. */}
            <View onLayout={onSectionLayout('overview')}>
              <HeatmapCard
                periodName={periodName}
                slideDirection={slideDirection}
                spentMinor={dispExpense}
                vsUsualPct={vsUsualPct}
                perDayMinor={perDay}
                spendDays={spendDays}
                countedDays={quiet.countedDays}
                isYear={byMonth}
                grid={
                  isCustomWindow(cursor)
                    ? buildRangeHeatGrid({ start: range.start, end: range.end, daily, onDayPress: openDay })
                    : buildHeatGrid({
                        granularity: cursor.granularity,
                        start: rangeStart,
                        trend,
                        daily,
                        onDayPress: openDay,
                      })
                }
              />
              <StoryCards title={`${periodName}, in short`} cards={stories} onJump={jumpTo} />
            </View>

            <View onLayout={onSectionLayout('categories')}>
              <Text style={styles.blockTitle}>{income ? 'Where it came from' : 'Where it went'}</Text>
              <View style={styles.flowSwitch}>
                <SegmentedControl
                  options={[
                    { value: 'expense', label: 'Spending' },
                    { value: 'income', label: 'Income' },
                  ]}
                  value={flow}
                  onChange={(f) => {
                    setFlow(f);
                    setCatExpanded(false);
                  }}
                />
              </View>
              {shownBreakdown.length === 0 ? (
                <Text style={styles.empty}>No income in {periodName}.</Text>
              ) : (
                <>
                  <CategoryMosaic
                    breakdown={shownBreakdown}
                    spentMinor={shownTotal}
                    deltas={deltas}
                    onPressCategory={onPressCategory}
                    onPressRest={() => setCatExpanded(true)}
                    kind={flow}
                  />
                  <CategoryList
                    breakdown={shownBreakdown}
                    spentMinor={shownTotal}
                    deltas={deltas}
                    expanded={catExpanded}
                    onToggleExpanded={() => setCatExpanded((v) => !v)}
                    onPressCategory={onPressCategory}
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

            <View onLayout={onSectionLayout('trends')} style={{ marginTop: 22 }}>
              <Text style={styles.blockTitle}>Trends</Text>
              <TrendChart
                periodName={periodName}
                spentMinor={current.expenseMinor}
                trend={trend}
                baseline={baseline}
                netWorthTrend={netWorthTrend}
              />
            </View>
          </>
        )}
      </ScrollView>

      <DaySheet iso={daySheet} txs={dayTx} catById={catById} onClose={() => setDaySheet(null)} />
    </View>
  );
}
