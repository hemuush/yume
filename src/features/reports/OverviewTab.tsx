import { memo, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import type { DailyExpensePoint, LargestExpense, PeriodComparison } from '@/db/reports';
import { findTopGrowingCategory } from '@/db/reports';
import { parseLocalIsoDate } from '@/lib/date';
import { roundedMinor } from '@/lib/round';
import { isCustomWindow, previousPeriodLabel, type ReportWindow } from '@/lib/period';
import type { Category, DateRange, Transaction } from '@/types';
import { BiggestSpends } from './BiggestSpends';
import { DayCard } from './DayCard';
import { DayInspector } from './DayInspector';
import { HeatmapCard, type HeatScope } from './HeatmapCard';
import { ReportHero } from './ReportHero';
import { ReportInsights } from './ReportInsights';
import type { ReportTab } from './ReportControls';
import {
  buildHeat,
  buildStoryCards,
  daySpendFacts,
  patternFacts,
  quietDays,
  recurringVsDiscretionary,
  type BudgetCover,
  type StoryAction,
} from './reportsInsights';
import { styles } from './reports.styles';

type DaySpendFacts = ReturnType<typeof daySpendFacts>;

// Each section compares its props by identity; the tab hands them values that keep theirs until what is in them changes.
const Hero = memo(ReportHero);
const Heatmap = memo(HeatmapCard);
const Insights = memo(ReportInsights);
const Biggest = memo(BiggestSpends);

const NO_DAYS: DailyExpensePoint[] = [];

/** How many categories get a chip on the heatmap. */
const HEAT_SCOPES = 4;

/**
 * Reports' "Overview": the period's spending in one line, the heatmap of its days with the day picked under it, the
 * "worth a look" cards and the biggest single spends. It compares its props by identity, so a day being picked, its
 * entries arriving or the biggest spends landing redraws what changed and not the heatmap and the cards beside it.
 */
export const OverviewTab = memo(function OverviewTab({
  cursor,
  range,
  periodName,
  custom,
  isYear,
  byMonth,
  daysInPeriod,
  cursorKey,
  today,
  accent,
  current,
  previous,
  daily,
  facts,
  budget,
  catById,
  catFilter,
  filtered,
  selectedDay,
  inspectIso,
  dayTx,
  dayError,
  sheetOpen,
  largest,
  largestKey,
  largestError,
  onInspectDay,
  onOpenSheet,
  onCloseSheet,
  onScope,
  onStoryAction,
  onShowBiggestDay,
  onOpenMonth,
  onRetryDay,
  onViewTab,
}: {
  cursor: ReportWindow;
  range: DateRange;
  periodName: string;
  custom: boolean;
  isYear: boolean;
  /** A year or a long custom range: shown by month, with no daily patterns. */
  byMonth: boolean;
  daysInPeriod: number;
  cursorKey: string;
  /** Today's date (ISO). */
  today: string;
  accent: string;
  current: PeriodComparison['current'];
  previous: PeriodComparison['previous'];
  daily: DailyExpensePoint[];
  facts: DaySpendFacts;
  budget: BudgetCover | null;
  catById: Map<string, Category>;
  /** The category the heatmap is narrowed to. */
  catFilter: string | null;
  /** That category's daily totals; the id says which category they belong to. */
  filtered: { id: string; daily: DailyExpensePoint[] } | null;
  selectedDay: string | null;
  /** The day under the inspector. */
  inspectIso: string;
  /** Its entries (null while they load). */
  dayTx: Transaction[] | null;
  dayError: string | null;
  sheetOpen: boolean;
  largest: { key: string; items: LargestExpense[] } | null;
  largestKey: string;
  largestError: string | undefined;
  onInspectDay: (iso: string) => void;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  onScope: (id: string | null) => void;
  onStoryAction: (action: StoryAction) => void;
  onShowBiggestDay: (iso: string) => void;
  /** A month row of the heatmap matrix opens Reports on that month. */
  onOpenMonth: (monthKey: string) => void;
  onRetryDay: () => void;
  onViewTab: (tab: ReportTab) => void;
}) {
  const dispExpense = roundedMinor(current.expenseMinor);
  const hasSpend = current.expenseMinor > 0;
  // A period with money in but nothing spent still has an Income breakdown and Trends to show.
  const hasData = hasSpend || current.incomeMinor > 0;
  const inProgress = range.end >= today;

  const filterId = catFilter;
  const filterCat = filterId ? catById.get(filterId) : undefined;
  const filterLoading = filterId != null && filtered?.id !== filterId;
  const heatDaily = useMemo(
    () => (filterId ? (filtered?.id === filterId ? filtered.daily : NO_DAYS) : daily),
    [filterId, filtered, daily]
  );
  const heat = useMemo(() => buildHeat({ range, daily: heatDaily, today }), [range, heatDaily, today]);
  const usualMinor = useMemo(
    () =>
      facts.countedDays > 0
        ? filterId
          ? Math.round(
              heatDaily.filter((d) => d.date <= today).reduce((sum, d) => sum + d.totalMinor, 0) /
                facts.countedDays
            )
          : facts.perDayMinor
        : 0,
    [facts, filterId, heatDaily, today]
  );
  const heatScopes = useMemo(() => {
    const scopes: HeatScope[] = [
      { id: null, name: 'All', color: accent },
      ...current.categoryBreakdown
        .slice(0, HEAT_SCOPES)
        .map((c) => ({ id: c.categoryId, name: c.name, color: c.color })),
    ];
    if (filterId && filterCat && !scopes.some((x) => x.id === filterId)) {
      scopes.push({ id: filterId, name: filterCat.name, color: filterCat.color });
    }
    return scopes;
  }, [accent, current.categoryBreakdown, filterId, filterCat]);
  const inspected = useMemo(() => {
    const days = heat.kind === 'calendar' ? heat.days : heat.rows.flatMap((r) => r.days);
    return days.find((d) => d?.iso === inspectIso) ?? null;
  }, [heat, inspectIso]);
  // With a category filter on, the day lists that category's entries (and its subcategories').
  const shownDayTx = useMemo(
    () =>
      dayTx && filterId
        ? dayTx.filter(
            (tx) =>
              tx.categoryId != null &&
              (tx.categoryId === filterId || catById.get(tx.categoryId)?.parentId === filterId)
          )
        : dayTx,
    [dayTx, filterId, catById]
  );
  const inspector = useMemo(
    () =>
      inspected ? (
        <DayInspector
          iso={inspectIso}
          spentMinor={inspected.minor}
          future={inspected.future}
          usualMinor={usualMinor}
          scopeName={filterCat?.name}
          txs={shownDayTx}
          catById={catById}
          onOpen={onOpenSheet}
        />
      ) : null,
    [inspected, inspectIso, usualMinor, filterCat?.name, shownDayTx, catById, onOpenSheet]
  );

  // The period "in short" as expandable insights (see buildStoryCards). The daily
  // pattern reads describe a month's shape, so a year view gets none.
  const stories = useMemo(() => {
    const topGrowing = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);
    const { recurringMinor, discretionaryMinor } = recurringVsDiscretionary(current.categoryBreakdown);
    return buildStoryCards({
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
      patterns: byMonth ? [] : patternFacts(daily, daysInPeriod, range, today),
      recurringMinor,
      discretionaryMinor,
      quiet: quietDays(daily, range, today),
      spendDays: facts.spendDays,
      isCurrentPeriod: isCustomWindow(cursor) ? range.end >= today : cursor.offset === 0,
      unit: custom ? 'period' : isYear ? 'year' : 'month',
    });
  }, [current, previous, cursor, custom, isYear, byMonth, daily, daysInPeriod, range, today, facts]);

  // What "Biggest spends" is measured against: the period's spending up to today, or that of the narrowed category.
  const biggestShareOf = useMemo(
    () =>
      filterId
        ? heatDaily.filter((d) => d.date <= today).reduce((sum, d) => sum + d.totalMinor, 0)
        : Math.max(0, dispExpense - facts.laterMinor),
    [filterId, heatDaily, today, dispExpense, facts.laterMinor]
  );

  if (!hasSpend) {
    return (
      <EmptyState
        title="Nothing spent in this period"
        subtitle={
          hasData
            ? 'Money in is under Breakdown, and Trends shows the bigger picture.'
            : 'Use the arrows to look back, or open Trends for recorded history.'
        }
      >
        <PrimaryButton
          title={hasData ? 'View breakdown' : 'View trends'}
          variant="secondary"
          onPress={() => onViewTab(hasData ? 'cats' : 'trends')}
        />
      </EmptyState>
    );
  }
  return (
    <>
      <Hero
        animKey={cursorKey}
        periodName={periodName}
        inProgress={inProgress}
        spentMinor={dispExpense}
        perDayMinor={facts.countedDays > 0 ? facts.perDayMinor : null}
        budget={budget}
        incomeMinor={current.incomeMinor}
        previousIncomeMinor={previous.incomeMinor}
        comparedTo={isCustomWindow(cursor) ? 'the period before' : previousPeriodLabel(cursor)}
      />
      <View style={filterLoading ? styles.dimmed : undefined}>
        <Heatmap
          model={heat}
          selectedIso={inspectIso}
          onSelect={onInspectDay}
          onOpenMonth={custom && !byMonth ? undefined : onOpenMonth}
          usualMinor={usualMinor}
          scopes={heatScopes}
          scopeId={filterId}
          onScope={onScope}
          hue={filterCat?.color ?? accent}
        >
          {inspector}
        </Heatmap>
      </View>
      {sheetOpen && (
        <ModalSheet
          visible
          onClose={onCloseSheet}
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
            onClose={onCloseSheet}
            error={dayError}
            onRetry={onRetryDay}
          />
        </ModalSheet>
      )}

      <Insights
        // A new period starts at the first card.
        key={`${range.start}:${range.end}`}
        title="Worth a look"
        cards={stories}
        onAction={onStoryAction}
      />
      {!byMonth && (!filterId || filtered?.id === filterId) && (
        <>
          {!largest || largest.key !== largestKey ? (
            !largestError && (
              <ActivityIndicator
                accessibilityLabel="Loading biggest spends"
                color={theme.colors.ink}
                style={styles.daySpinner}
              />
            )
          ) : (
            <Biggest
              key={largestKey}
              items={largest.items}
              catById={catById}
              shareOfMinor={biggestShareOf}
              openIso={selectedDay}
              onOpenDay={onShowBiggestDay}
              inProgress={inProgress}
              scopeName={filterCat?.name}
            />
          )}
        </>
      )}
    </>
  );
});
