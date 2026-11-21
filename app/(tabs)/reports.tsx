import { useKeptAcrossModeChange } from '@/theme/useKeptAcrossModeChange';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, ScrollViewInstance, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text } from '@/components/Text';
import { TAB_ENTER } from '@/lib/animation';
import { isIsoDate, toLocalIsoDate } from '@/lib/date';
import { CURRENT_PERIOD, isCustomWindow, windowRange, type ReportWindow } from '@/lib/period';
import { useTabScrollPad } from '@/lib/uiScale';
import { useTabScrollToTop } from '@/hooks/useTabScrollToTop';
import { useAccent } from '@/theme/AccentContext';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { BreakdownTab } from '@/features/reports/BreakdownTab';
import { OverviewTab } from '@/features/reports/OverviewTab';
import { periodModel } from '@/features/reports/periodModel';
import { ReportTabs, type ReportTab } from '@/features/reports/ReportControls';
import { ReportsHeader } from '@/features/reports/ReportsHeader';
import { ReportsSkeleton } from '@/features/reports/ReportsSkeleton';
import { TrendsTab } from '@/features/reports/TrendsTab';
import { useDayEntries } from '@/features/reports/useDayEntries';
import { useReportDetails, type CategoryGroup } from '@/features/reports/useReportDetails';
import { useReportsData } from '@/features/reports/useReportsData';
import type { StoryAction } from '@/features/reports/reportsInsights';
import { styles } from '@/features/reports/reports.styles';
import type { CategoryBreakdownItem } from '@/db/reports';

/** Rows shown before "N more" in Categories (CategoryList's own limit). */
const CATEGORIES_COLLAPSED = 5;

const Header = memo(ReportsHeader);

export default function ReportsScreen() {
  const { accent, secondary } = useAccent();
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const [cursor, setCursor] = useState<ReportWindow>(CURRENT_PERIOD);
  // "Where it went" (spending) or "Where it came from" (income).
  const [flow, setFlow] = useState<'expense' | 'income'>('expense');
  // Overview, Breakdown or Trends: one lens at a time under the period control.
  const [tab, setTab] = useKeptAcrossModeChange<ReportTab>('reports-tab', 'days');
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

  // The heatmap day open under the grid, and whether its sheet is open.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // A category the heatmap is narrowed to.
  const [catFilter, setCatFilter] = useState<string | null>(null);
  // The category row opened in Categories, with its subcategory split.
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  // Categories grouped by category (the default) or by account, with the account row opened.
  const [labelsOpen, setLabelsOpen] = useState(false);
  useEffect(() => setLabelsOpen(false), [tab, cursor, flow]);
  const [group, setGroup] = useState<CategoryGroup>('category');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  // "Where it went" shows the top 5 categories by default like every long list; reset on period change so a
  // stale month's expanded list never carries over.
  const [catExpanded, setCatExpanded] = useState(false);
  // Stable header and tabs are normal-flow siblings, so neither can cover content.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const resetScroll = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []);
  useTabScrollToTop(scrollRef);

  const onLoadStart = useCallback(() => setCatExpanded(false), []);
  const data = useReportsData(cursor, { onLoadStart });
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await data.reload();
    } finally {
      setRefreshing(false);
    }
  };
  const {
    hideAmounts,
    comparison,
    categories,
    savingsIds,
    daily,
    budget,
    startingBalanceNames,
    trend,
    netWorthTrend,
    cashFlow,
    catTracks,
    ready,
    status,
    errorText,
    version,
    load,
  } = data;
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const range = useMemo(() => windowRange(cursor), [cursor]);
  const today = toLocalIsoDate(new Date());
  // A new period starts clean: no day open, no filter, no category picked.
  const cursorKey = isCustomWindow(cursor)
    ? `${cursor.start}|${cursor.end}`
    : `${cursor.granularity}:${cursor.offset}`;
  // The day under the heatmap's inspector: the one touched last, else today (or the period's last day).
  const inspectIso = selectedDay ?? (range.end < today ? range.end : today);
  const dayEntries = useDayEntries({ iso: inspectIso, hideAmounts, catById, savingsIds, version });
  const details = useReportDetails({
    cursor,
    cursorKey,
    hideAmounts,
    ready,
    version,
    flow,
    group,
    catFilter,
    selectedCat,
  });
  const { clearFiltered, retry: retryDetails } = details;
  useEffect(() => {
    setSelectedDay(null);
    setSheetOpen(false);
    setCatFilter(null);
    setSelectedCat(null);
    setSelectedAccount(null);
  }, [cursorKey, hideAmounts]);
  // A different report view or period starts at the top.
  // A new sub-tab starts at the top. The scroll view itself stays mounted (remounting it on every tap rebuilt the
  // heatmap and charts and hitched), so the jump to the top is explicit.
  useEffect(() => {
    resetScroll();
  }, [tab, cursor, resetScroll, scrollRef]);

  // The handlers below keep one identity, so the tabs (which compare their props) are drawn again only for what
  // changed. What they read that changes is read through a ref.
  const breakdownRef = useRef(comparison?.current.categoryBreakdown);
  useEffect(() => {
    breakdownRef.current = comparison?.current.categoryBreakdown;
  });
  // Picking a day only inspects it; its sheet opens from the inspector (or a story / biggest spend).
  const inspectDay = useCallback((iso: string) => setSelectedDay(iso), []);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeDay = useCallback(() => setSheetOpen(false), []);
  const showBiggestDay = useCallback((iso: string) => {
    setSelectedDay(iso);
    setSheetOpen(true);
  }, []);
  const pickCategory = useCallback((id: string) => {
    setSelectedCat(id);
    if ((breakdownRef.current ?? []).findIndex((c) => c.categoryId === id) >= CATEGORIES_COLLAPSED) {
      setCatExpanded(true);
    }
  }, []);
  const onStoryAction = useCallback(
    (a: StoryAction) => {
      if (a.type === 'day') {
        setCatFilter(null);
        setSelectedDay(a.iso);
        setSheetOpen(true);
        return;
      }
      setTab('cats');
      setGroup('category');
      setFlow('expense');
      if (a.type === 'category') pickCategory(a.id);
      else setSelectedCat(null);
    },
    [pickCategory, setTab]
  );
  const onScope = useCallback(
    (id: string | null) => {
      setCatFilter(id);
      clearFiltered();
    },
    [clearFiltered]
  );
  // A month row of the heatmap matrix opens Reports on that month.
  const openMonthOf = useCallback((monthKey: string) => {
    const [y, m] = monthKey.split('-').map(Number);
    const now = new Date();
    const offset = y * 12 + (m - 1) - (now.getFullYear() * 12 + now.getMonth());
    if (offset <= 0 && offset >= -120) setCursor({ granularity: 'month', offset });
  }, []);
  // A category opens its own page (app/category/[id].tsx), on this same period.
  const openCategory = useCallback(
    (categoryId: string) => {
      const href = isCustomWindow(cursor)
        ? `/category/${categoryId}?g=custom&from=${cursor.start}&to=${cursor.end}`
        : `/category/${categoryId}?g=${cursor.granularity}&o=${cursor.offset}`;
      router.push(href);
    },
    [cursor]
  );
  const openBreakdownCategory = useCallback(
    (c: CategoryBreakdownItem) => openCategory(c.categoryId),
    [openCategory]
  );
  const showCategoryDays = useCallback(
    (c: CategoryBreakdownItem) => {
      setSheetOpen(false);
      setCatFilter(c.categoryId);
      clearFiltered();
      setTab('days');
    },
    [clearFiltered, setTab]
  );
  const changeFlow = useCallback((f: 'expense' | 'income') => {
    setFlow(f);
    setCatExpanded(false);
    setSelectedCat(null);
    setSelectedAccount(null);
  }, []);
  const changeGroup = useCallback((g: CategoryGroup) => {
    setGroup(g);
    setCatExpanded(false);
    setSelectedCat(null);
    setSelectedAccount(null);
  }, []);
  const openLabels = useCallback(() => setLabelsOpen(true), []);
  const closeLabels = useCallback(() => setLabelsOpen(false), []);
  const toggleExpanded = useCallback(() => setCatExpanded((v) => !v), []);
  const selectCategory = useCallback(
    (c: CategoryBreakdownItem) => setSelectedCat((id) => (id === c.categoryId ? null : c.categoryId)),
    []
  );
  const selectAccount = useCallback(
    (a: CategoryBreakdownItem) => setSelectedAccount((id) => (id === a.categoryId ? null : a.categoryId)),
    []
  );
  const retryDay = dayEntries.retry;

  // What the tabs share about the period on show.
  const model = useMemo(
    () =>
      comparison
        ? periodModel({ cursor, range, daily, today, expenseMinor: comparison.current.expenseMinor })
        : null,
    [comparison, cursor, range, daily, today]
  );

  // Use the same stable header in loading, error and ready states.
  const header = <Header cursor={cursor} onChange={setCursor} />;
  if (status === 'error' && !ready) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} plain />
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
  if (!ready || !comparison || !model) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} plain />
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
  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      {header}
      <ReportTabs value={tab} onChange={setTab} />
      <ScrollView
        ref={scrollRef}
        testID="reports-content"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={accent} colors={[accent]} />
        }
        contentContainerStyle={{
          paddingTop: 12,
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
        {Object.keys(details.errors).length > 0 && (
          <View style={styles.tidyNudge}>
            <Text style={styles.errTitle}>Some report details couldn’t load</Text>
            <Text style={styles.errDetail}>{Object.values(details.errors).join('\n')}</Text>
            <PrimaryButton title="Retry details" variant="secondary" onPress={retryDetails} />
          </View>
        )}
        <Animated.View key={tab} entering={TAB_ENTER}>
          {tab === 'days' ? (
            <OverviewTab
              cursor={cursor}
              range={range}
              periodName={model.periodName}
              custom={model.custom}
              isYear={model.isYear}
              byMonth={model.byMonth}
              daysInPeriod={model.daysInPeriod}
              cursorKey={cursorKey}
              today={today}
              accent={accent}
              current={current}
              previous={previous}
              daily={daily}
              facts={model.facts}
              budget={budget}
              catById={catById}
              catFilter={catFilter}
              filtered={details.filtered}
              selectedDay={selectedDay}
              inspectIso={inspectIso}
              dayTx={dayEntries.txs}
              dayError={dayEntries.error}
              sheetOpen={sheetOpen}
              largest={details.largest}
              largestKey={details.largestKey}
              largestError={details.errors.largest}
              onInspectDay={inspectDay}
              onOpenSheet={openSheet}
              onCloseSheet={closeDay}
              onScope={onScope}
              onStoryAction={onStoryAction}
              onShowBiggestDay={showBiggestDay}
              onOpenMonth={openMonthOf}
              onRetryDay={retryDay}
              onViewTab={setTab}
            />
          ) : tab === 'cats' ? (
            <BreakdownTab
              cursor={cursor}
              range={range}
              periodName={model.periodName}
              custom={model.custom}
              today={today}
              flow={flow}
              group={group}
              current={current}
              previous={previous}
              catById={catById}
              startingBalanceNames={startingBalanceNames}
              selectedCat={selectedCat}
              selectedAccount={selectedAccount}
              expanded={catExpanded}
              split={details.split}
              splitError={details.errors.split}
              accounts={details.accounts}
              accountsKey={details.accountsKey}
              accountsError={details.errors.accounts}
              labelsOpen={labelsOpen}
              onFlow={changeFlow}
              onGroup={changeGroup}
              onOpenLabels={openLabels}
              onCloseLabels={closeLabels}
              onToggleExpanded={toggleExpanded}
              onSelectCategory={selectCategory}
              onSelectAccount={selectAccount}
              onRetrySplit={retryDetails}
              onOpenCategory={openBreakdownCategory}
              onShowDays={showCategoryDays}
            />
          ) : (
            <TrendsTab
              cursor={cursor}
              range={range}
              cursorKey={cursorKey}
              periodName={model.periodName}
              daysInPeriod={model.daysInPeriod}
              today={today}
              spentMinor={current.expenseMinor}
              trend={trend}
              netWorthTrend={netWorthTrend}
              cashFlow={cashFlow}
              catTracks={catTracks}
              catById={catById}
              facts={model.facts}
              onStepCursor={setCursor}
              onOpenCategory={openCategory}
            />
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
