import { memo, useCallback, useMemo } from 'react';
import { EmptyState } from '@/components/EmptyState';
import type { CashFlowPoint, CategoryTrack, NetWorthPoint, TrendPoint } from '@/db/reports';
import type { ReportWindow } from '@/lib/period';
import { isCustomWindow } from '@/lib/period';
import type { Category, DateRange } from '@/types';
import { CategoryTracks } from './CategoryTracks';
import { ReportTrends } from './ReportTrends';
import { MIN_TREND_POINTS } from './TrendChart';
import { baselineFromTrend, categoriesAgainstUsual, type daySpendFacts } from './reportsInsights';

type DaySpendFacts = ReturnType<typeof daySpendFacts>;

const Trends = memo(ReportTrends);
const Tracks = memo(CategoryTracks);

/**
 * Reports' "Trends": the months behind the period (spending, cash flow or net worth) and each category against its
 * usual. It compares its props by identity, so nothing on it redraws for a change made on another tab.
 */
export const TrendsTab = memo(function TrendsTab({
  cursor,
  range,
  cursorKey,
  periodName,
  daysInPeriod,
  today,
  spentMinor,
  trend,
  netWorthTrend,
  cashFlow,
  catTracks,
  catById,
  facts,
  onStepCursor,
  onOpenCategory,
}: {
  cursor: ReportWindow;
  range: DateRange;
  cursorKey: string;
  periodName: string;
  daysInPeriod: number;
  /** Today's date (ISO). */
  today: string;
  spentMinor: number;
  trend: TrendPoint[];
  netWorthTrend: NetWorthPoint[];
  cashFlow: CashFlowPoint[];
  catTracks: CategoryTrack[];
  catById: Map<string, Category>;
  facts: DaySpendFacts;
  /** A point on the trend chart stands for a month: this opens Reports on it. */
  onStepCursor: (cursor: ReportWindow) => void;
  onOpenCategory: (categoryId: string) => void;
}) {
  const baseline = useMemo(() => baselineFromTrend(trend), [trend]);
  const monthInProgress = !isCustomWindow(cursor) && cursor.granularity === 'month' && cursor.offset === 0;
  const historyInProgress =
    cashFlow.filter((p) => p.recorded !== false).at(-1)?.month === today.slice(0, 7) || monthInProgress;
  const rows = useMemo(() => categoriesAgainstUsual(catTracks), [catTracks]);
  const custom = isCustomWindow(cursor);
  const monthLink = useMemo(
    () =>
      custom
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
              open: () => onStepCursor({ granularity: 'month', offset }),
            };
          },
    [custom, cursor, range.end, onStepCursor]
  );
  const openCategory = useCallback((id: string) => onOpenCategory(id), [onOpenCategory]);

  if (trend.length < MIN_TREND_POINTS && netWorthTrend.length < MIN_TREND_POINTS) {
    return (
      <EmptyState
        title="Not enough history yet"
        subtitle="Trends show up once there are a few months of entries."
      />
    );
  }
  return (
    <>
      <Trends
        cashFlow={cashFlow}
        key={cursorKey}
        periodName={periodName}
        spentMinor={spentMinor}
        trend={trend}
        baseline={baseline}
        inProgress={monthInProgress}
        netWorthTrend={netWorthTrend}
        monthLink={monthLink}
        projectedMinor={
          monthInProgress && facts.countedDays > 0 ? Math.round(facts.perDayMinor * daysInPeriod) : null
        }
      />
      <Tracks rows={rows} catById={catById} inProgress={historyInProgress} onOpen={openCategory} />
    </>
  );
});
