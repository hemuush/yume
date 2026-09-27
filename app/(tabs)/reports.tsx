import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
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
import { listTransactions, listCategories } from '@/db/ledger';
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
import { parseLocalIsoDate, toLocalIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { ReportsSkeleton } from '@/features/reports/ReportsSkeleton';
import { PeriodRow } from '@/features/reports/PeriodRow';
import { JumpBar, ReportSection } from '@/features/reports/JumpBar';
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
} from '@/features/reports/reportsInsights';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState<ReportWindow>(CURRENT_PERIOD);
  // "Where it went" (spending) or "Where it came from" (income).
  const [flow, setFlow] = useState<'expense' | 'income'>('expense');
  // Categories Tidy up reads as starting balances logged as income: the
  // Income view points at Tidy up when one of them makes up most of it.
  const [startingBalanceNames, setStartingBalanceNames] = useState<string[]>([]);
  // `/reports?month=-1` opens on a specific month (0 = this month, -1 = last
  // month) — used by Home's month-in-review card. Reports is a tab, so it may
  // already be mounted: this reacts to each new link, then clears the param
  // so a later visit to the tab isn't pulled back to that month.
  const { month: monthParam } = useLocalSearchParams<{ month?: string }>();
  useEffect(() => {
    if (monthParam == null) return;
    const offset = Number(monthParam);
    if (Number.isInteger(offset) && offset <= 0 && offset >= -120) {
      setCursor({ granularity: 'month', offset });
    }
    router.setParams({ month: undefined });
  }, [monthParam]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
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

  // The jump bar below (Overview / Categories / Trends) — `sectionY` is
  // filled in by each section's own onLayout, not measured up front, since
  // heights here depend on real data (how many categories, whether the
  // moon card even renders this period).
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<ReportSection>('overview');
  // react-hooks/refs misreads this: calling onSectionLayout(key) in render
  // only *builds* the onLayout handler — the ref is written inside it, when
  // layout fires, never during render.
  const onSectionLayout = (key: string) => (e: LayoutChangeEvent) => {
    // eslint-disable-next-line react-hooks/refs
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  // A tap-to-jump animates the scroll over ~300ms, and onScroll keeps firing
  // throughout that animation with every intermediate position it passes
  // through on the way — left unguarded, the chip you just tapped would
  // flicker through whichever section happens to scroll by mid-animation
  // before landing on the right one. This suppresses onScroll's own
  // recompute for as long as a jump is in flight, so the tapped chip stays
  // lit the whole time instead of visibly flickering through the others.
  const jumpingRef = useRef(false);
  const jumpTo = (key: ReportSection) => {
    jumpingRef.current = true;
    setActiveSection(key);
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] ?? 0) - 8), animated: true });
    setTimeout(() => {
      jumpingRef.current = false;
    }, 500);
  };
  // Whichever section's top has scrolled past (with a little lead-in so the
  // switch feels like it happens as that section arrives, not once it's
  // already filled the screen) is the active one — checked in layout order
  // so a section further down never wins over one still above it.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (jumpingRef.current) return;
    const y = e.nativeEvent.contentOffset.y;
    let current: ReportSection = 'overview';
    for (const key of ['overview', 'categories', 'trends'] as const) {
      if (y >= (sectionY.current[key] ?? Infinity) - 60) current = key;
    }
    setActiveSection(current);
  };

  // Only the most recent load may write state — stepping periods quickly
  // starts overlapping loads, and an earlier one can finish last.
  const loadSeq = useRef(0);
  const load = useCallback(async (c: ReportWindow) => {
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
      const [cmp, tr, nw, dy, cats, tidy] = await Promise.all([
        getRangeComparison(range, previousWindowRange(c), isCustomWindow(c) ? 'month' : c.granularity),
        getMonthlyExpenseTrend(trendMonths, anchor),
        getNetWorthTrend(trendMonths, anchor),
        getDailyExpenseTotals(range),
        listCategories(),
        getTidyUpReport().catch(() => null),
      ]);
      if (seq !== loadSeq.current) return;
      setComparison(cmp);
      setTrend(tr);
      setNetWorthTrend(nw);
      setDaily(dy);
      setCategories(cats);
      setStartingBalanceNames(tidy ? tidy.startingBalances.map((g) => g.categoryName) : []);
      setStatus('ready');
      setErrorText(null);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      setErrorText(String(e?.message ?? e));
      setStatus('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(cursor);
    }, [load, cursor])
  );

  const openDay = useCallback(async (iso: string) => {
    setDaySheet(iso);
    setDayTx(null);
    setDayTx(await listTransactions({ fromDate: iso, toDate: iso }));
  }, []);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Pinned (outside the ScrollView, not scrolled away) rather than the
  // jump bar living inline in the scrolling content — it stays reachable
  // and keeps showing which section you're in no matter how far down
  // you've scrolled, not just at the top of the page.
  const header = (
    <>
      <AppHeader title="Reports" />
      <PeriodRow cursor={cursor} onChange={setCursor} />
      {comparison && comparison.current.expenseMinor > 0 && (
        <JumpBar active={activeSection} onJump={jumpTo} />
      )}
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
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
        }}
      >
        {!hasSpend ? (
          <Text style={styles.empty}>
            Nothing spent in this period. Use the arrows above to look back at a month with data.
          </Text>
        ) : (
          <>
            {/* Overview: the heatmap on top (with the headline in it), then the period in short. */}
            <View onLayout={onSectionLayout('overview')}>
              <HeatmapCard
                periodName={periodName}
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
                  style={styles.tidyNudge}
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
