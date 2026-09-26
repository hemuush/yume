import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Text } from '@/components/Text';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getRangeComparison,
  PeriodComparison,
  findTopGrowingCategory,
  getMonthlyExpenseTrend,
  getNetWorthTrend,
  getSubcategoryBreakdown,
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
  PeriodCursor,
  periodLabel,
  periodRange,
  previousPeriodRange,
  previousPeriodLabel,
} from '@/lib/period';
import { parseLocalIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { InShortCard } from '@/features/reports/InShortCard';
import { SkylineRibbon } from '@/features/reports/SkylineRibbon';
import { ReportsSkeleton } from '@/features/reports/ReportsSkeleton';
import { PeriodRow } from '@/features/reports/PeriodRow';
import { JumpBar, ReportSection } from '@/features/reports/JumpBar';
import { ReportsHeadline } from '@/features/reports/ReportsHeadline';
import { HeatmapSection } from '@/features/reports/HeatmapSection';
import { MoonCard } from '@/features/reports/MoonCard';
import { CategoryList } from '@/features/reports/CategoryList';
import { TrendsSection } from '@/features/reports/TrendsSection';
import { SubcategorySheet, DaySheet, CategoryTxSheet } from '@/features/reports/ReportSheets';
import { styles } from '@/features/reports/reports.styles';
import {
  buildHeatGrid,
  baselineFromTrend,
  recurringVsDiscretionary,
  categoryDeltas,
  describeSpendingPattern,
  buildInShortLines,
} from '@/features/reports/reportsInsights';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
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

  const [drill, setDrill] = useState<{ categoryId: string; name: string } | null>(null);
  const [drillItems, setDrillItems] = useState<CategoryBreakdownItem[] | null>(null);
  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [dayTx, setDayTx] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // "Where it went" shows the top 5 categories by default, like every other
  // long list in the app — reset whenever the period changes so switching
  // months never leaves a stale month's list expanded.
  const [catExpanded, setCatExpanded] = useState(false);

  // A category with no subcategories used to be a dead tap — `openDrill`
  // only ever made sense for one with children to show a split for. This is
  // that same tap for the flat case: the actual transaction list, reusing
  // the day-detail sheet's own row rendering just filtered by category
  // instead of date.
  const [catTxSheet, setCatTxSheet] = useState<{
    categoryId: string;
    name: string;
    isSensitive: boolean;
  } | null>(null);
  const [catTx, setCatTx] = useState<Transaction[] | null>(null);

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
  const load = useCallback(async (c: PeriodCursor) => {
    const seq = ++loadSeq.current;
    setCatExpanded(false);
    const range = periodRange(c);
    const anchor = parseLocalIsoDate(range.end);
    const trendMonths = c.granularity === 'year' ? 12 : 7;
    try {
      setStatus((s) => (s === 'ready' ? s : 'loading'));
      const [cmp, tr, nw, dy, cats] = await Promise.all([
        getRangeComparison(range, previousPeriodRange(c), c.granularity),
        getMonthlyExpenseTrend(trendMonths, anchor),
        getNetWorthTrend(trendMonths, anchor),
        getDailyExpenseTotals(range),
        listCategories(),
      ]);
      if (seq !== loadSeq.current) return;
      setComparison(cmp);
      setTrend(tr);
      setNetWorthTrend(nw);
      setDaily(dy);
      setCategories(cats);
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

  const openDrill = useCallback(
    async (cat: { categoryId: string; name: string }) => {
      setDrill(cat);
      setDrillItems(null);
      setDrillItems(await getSubcategoryBreakdown(cat.categoryId, periodRange(cursor)));
    },
    [cursor]
  );

  const openDay = useCallback(async (iso: string) => {
    setDaySheet(iso);
    setDayTx(null);
    setDayTx(await listTransactions({ fromDate: iso, toDate: iso }));
  }, []);

  const openCategoryTx = useCallback(
    async (cat: { categoryId: string; name: string; isSensitive: boolean }) => {
      setCatTxSheet(cat);
      setCatTx(null);
      const r = periodRange(cursor);
      // Rolled up like the category's total itself — spend under a since-
      // archived subcategory counts toward the parent's total (and the
      // drill-down isn't offered once every subcategory is archived), so the
      // list has to include it too or it wouldn't add up to that total.
      setCatTx(
        await listTransactions({
          categoryId: cat.categoryId,
          includeSubcategories: true,
          fromDate: r.start,
          toDate: r.end,
        })
      );
    },
    [cursor]
  );

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
  const periodName = periodLabel(cursor);
  const dispExpense = roundedMinor(current.expenseMinor);
  const hasSpend = current.expenseMinor > 0;

  const range = periodRange(cursor);
  const rangeStart = parseLocalIsoDate(range.start);
  const rangeEnd = parseLocalIsoDate(range.end);
  const daysInPeriod = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;

  const baseline = baselineFromTrend(trend);
  const vsUsualPct = baseline && baseline > 0 ? ((current.expenseMinor - baseline) / baseline) * 100 : null;
  const perDay = daysInPeriod > 0 ? Math.round(dispExpense / daysInPeriod) : 0;
  const spendDays = daily.filter((d) => d.totalMinor > 0).length;
  const reads = describeSpendingPattern(daily, daysInPeriod);
  const { recurringMinor, discretionaryMinor } = recurringVsDiscretionary(current.categoryBreakdown);
  const topGrowing = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);

  // "In short": the answers first (see buildInShortLines). The daily-pattern
  // reads describe a month's shape, so a year view gets none here — it keeps
  // showing them under its heatmap exactly as before.
  const inShort = buildInShortLines({
    mover: topGrowing ? { name: topGrowing.name, pctChange: topGrowing.pctChange } : null,
    comparisonLabel: previousPeriodLabel(cursor),
    patternReads: cursor.granularity === 'month' ? reads : [],
    recurringMinor,
    discretionaryMinor,
    spendDays,
    isCurrentPeriod: cursor.offset === 0,
  });
  // Each answer appears once: reads already shown in the card aren't repeated
  // under the heatmap.
  const remainingReads = reads.filter((_, i) => !inShort.lines.some((l) => l.key === `read-${i}`));

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
            <View onLayout={onSectionLayout('overview')}>
              <ReportsHeadline
                periodName={periodName}
                spentMinor={dispExpense}
                vsUsualPct={vsUsualPct}
                perDayMinor={perDay}
                spendDays={spendDays}
                daysInPeriod={daysInPeriod}
              />
              <InShortCard lines={inShort.lines} tooEarly={inShort.tooEarly} onJump={jumpTo} />
              <HeatmapSection
                title={cursor.granularity === 'year' ? 'Month by month' : 'Day by day'}
                grid={buildHeatGrid({
                  granularity: cursor.granularity,
                  start: rangeStart,
                  trend,
                  daily,
                  onDayPress: openDay,
                })}
                reads={remainingReads}
              />
            </View>

            <View style={styles.rule} />

            <View onLayout={onSectionLayout('categories')}>
              {recurringMinor + discretionaryMinor > 0 && (
                <>
                  <MoonCard
                    periodName={periodName}
                    recurringMinor={recurringMinor}
                    discretionaryMinor={discretionaryMinor}
                  />
                  <View style={styles.rule} />
                </>
              )}
              <Text style={styles.blockTitle}>Where it went</Text>
              <SkylineRibbon categories={current.categoryBreakdown} totalMinor={dispExpense} />
              <CategoryList
                breakdown={current.categoryBreakdown}
                spentMinor={dispExpense}
                deltas={categoryDeltas(current.categoryBreakdown, previous.categoryBreakdown)}
                expanded={catExpanded}
                onToggleExpanded={() => setCatExpanded((v) => !v)}
                onPressCategory={(c) =>
                  c.hasSubcategories
                    ? openDrill(c)
                    : openCategoryTx({ categoryId: c.categoryId, name: c.name, isSensitive: c.isSensitive })
                }
              />
            </View>

            <View onLayout={onSectionLayout('trends')}>
              <TrendsSection
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

      <SubcategorySheet title={drill?.name ?? null} items={drillItems} onClose={() => setDrill(null)} />
      <DaySheet iso={daySheet} txs={dayTx} catById={catById} onClose={() => setDaySheet(null)} />
      <CategoryTxSheet category={catTxSheet} txs={catTx} onClose={() => setCatTxSheet(null)} />
    </View>
  );
}
