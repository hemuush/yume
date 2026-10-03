import {
  getRangeComparison,
  getDailyExpenseTotals,
  getPeriodSummary,
  findTopGrowingCategory,
  PeriodComparison,
  PeriodSummary,
  DailyExpensePoint,
} from '@/db/reports';
import { getCachedHideSensitiveAmounts } from '@/db/settings';
import { privateComparison, privateSummary } from '@/lib/privateSummary';
import { periodRange, previousPeriodRange } from '@/lib/period';
import { addDaysToIsoDate, isoDatesInRange, parseLocalIsoDate, toLocalIsoDate } from '@/lib/date';
import { dayMonth, longMonth } from '@/lib/dateLabels';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct } from '@/lib/savingsRate';

/**
 * Month and week Wraps: a short story in beats from numbers Reports and the month review already compute. Pure
 * builders decide which beats exist (one with nothing true to say is left out); loaders fetch; nothing stored.
 */

export type WrapPeriod = 'month' | 'week';

export interface WrapCategory {
  categoryId: string;
  name: string;
  color: string;
  totalMinor: number;
  isSensitive: boolean;
}

export interface WrapDay {
  date: string;
  totalMinor: number;
}

export type WrapBeat =
  /** The hook: the period's name and what went out. */
  | { kind: 'hook'; kicker: string; title: string; spentMinor: number }
  /** How much of what came in was kept. `keptMinor` is negative when more went out than came in. */
  | { kind: 'kept'; incomeMinor: number; keptMinor: number; keptPct: number }
  /** The biggest categories, largest first. */
  | { kind: 'bars'; items: WrapCategory[] }
  /** A month's days in calendar order, with the heaviest one and the count of days nothing went out. */
  | { kind: 'days'; days: WrapDay[]; firstWeekday: number; heaviest: WrapDay; quietDays: number }
  /** The category that grew the most against the period before. */
  | { kind: 'mover'; category: WrapCategory; pctChange: number; comparedTo: string }
  /** A week's seven days, Sunday first. */
  | { kind: 'weekDays'; days: WrapDay[]; heaviest: WrapDay; quietDays: number }
  /** A week against the usual week, and what led it. */
  | { kind: 'usual'; changePct: number; top: WrapCategory | null }
  /** The closing frame. */
  | { kind: 'final'; title: string };

export interface Wrap {
  period: WrapPeriod;
  /** Shown top-left while the Wrap plays: "September", "21–27 Sept". */
  label: string;
  /** "YYYY-MM" for a month (what closing marks as seen); the week's first day for a week. */
  key: string;
  beats: WrapBeat[];
}

/** How long each beat plays (ms). A skipped beat shortens the Wrap rather than stretching the others. */
export const BEAT_MS: Record<WrapBeat['kind'], number> = {
  hook: 1500,
  kept: 2500,
  bars: 3000,
  days: 3000,
  mover: 2500,
  weekDays: 2500,
  usual: 2000,
  final: 2500,
};

/** The most categories the bars beat shows — five fit a phone and still read at a glance. */
export const WRAP_MAX_BARS = 5;

/** Within this many percent of the usual week, a week reads as "about usual". */
export const USUAL_BAND_PCT = 5;

function toWrapCategories(summary: PeriodSummary): WrapCategory[] {
  return [...summary.categoryBreakdown]
    .filter((c) => c.totalMinor > 0)
    .sort((a, b) => b.totalMinor - a.totalMinor)
    .map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      color: c.color,
      totalMinor: roundedMinor(c.totalMinor),
      isSensitive: c.isSensitive,
    }));
}

/** Every day in `start`..`end`, with its spend (0 when nothing went out). */
export function fillDays(start: string, end: string, daily: DailyExpensePoint[]): WrapDay[] {
  const byDate = new Map(daily.map((d) => [d.date, d.totalMinor]));
  return isoDatesInRange(start, end).map((date) => ({
    date,
    totalMinor: roundedMinor(byDate.get(date) ?? 0),
  }));
}

function heaviestOf(days: WrapDay[]): WrapDay {
  // The earliest wins a tie, so the answer doesn't depend on sort stability.
  return days.reduce((best, d) => (d.totalMinor > best.totalMinor ? d : best), days[0]);
}

/**
 * The month Wrap for the month starting `monthStart`, or null when nothing went out (Home's Wrap button
 * doesn't offer it either).
 */
export function buildMonthWrap(input: {
  monthStart: string;
  monthEnd: string;
  comparison: PeriodComparison;
  daily: DailyExpensePoint[];
}): Wrap | null {
  const { current, previous } = input.comparison;
  const spentMinor = roundedMinor(current.expenseMinor);
  if (spentMinor <= 0) return null;
  const monthLabel = longMonth(input.monthStart);
  const beats: WrapBeat[] = [{ kind: 'hook', kicker: 'Your month, wrapped', title: monthLabel, spentMinor }];

  const incomeMinor = roundedMinor(current.incomeMinor);
  if (incomeMinor > 0) {
    const keptMinor = incomeMinor - spentMinor;
    beats.push({ kind: 'kept', incomeMinor, keptMinor, keptPct: savingsRatePct(keptMinor, incomeMinor) });
  }

  const categories = toWrapCategories(current);
  if (categories.length > 0) beats.push({ kind: 'bars', items: categories.slice(0, WRAP_MAX_BARS) });

  const days = fillDays(input.monthStart, input.monthEnd, input.daily);
  beats.push({
    kind: 'days',
    days,
    firstWeekday: parseLocalIsoDate(input.monthStart).getDay(),
    heaviest: heaviestOf(days),
    quietDays: days.filter((d) => d.totalMinor === 0).length,
  });

  const mover = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);
  const moverCategory = mover ? categories.find((c) => c.categoryId === mover.categoryId) : undefined;
  if (mover && moverCategory) {
    const monthBefore = addDaysToIsoDate(input.monthStart, -1);
    beats.push({
      kind: 'mover',
      category: moverCategory,
      pctChange: mover.pctChange,
      comparedTo: longMonth(monthBefore),
    });
  }

  beats.push({ kind: 'final', title: `That was ${monthLabel}.` });
  return { period: 'month', label: monthLabel, key: input.monthStart.slice(0, 7), beats };
}

/** The last full Sunday–Saturday week before `today` (the week starts on Sunday in Yume). */
export function lastFullWeek(today: Date): { start: string; end: string } {
  const back = today.getDay() + 1; // Sunday → yesterday (Saturday); Saturday → the Saturday before
  const end = toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back));
  return { start: addDaysToIsoDate(end, -6), end };
}

/** "21–27 Sept", or "28 Sept – 4 Oct" across a month's end. */
export function weekLabel(start: string, end: string): string {
  return start.slice(0, 7) === end.slice(0, 7)
    ? `${parseLocalIsoDate(start).getDate()}–${dayMonth(end)}`
    : `${dayMonth(start)} – ${dayMonth(end)}`;
}

/**
 * The week Wrap. A week with nothing logged still gets a one-frame Wrap saying so (the Monday notification was
 * sent). `usualWeekMinor` is the average of prior weeks; null without history, which leaves that beat out.
 */
export function buildWeekWrap(input: {
  start: string;
  end: string;
  summary: PeriodSummary;
  daily: DailyExpensePoint[];
  usualWeekMinor: number | null;
}): Wrap {
  const label = weekLabel(input.start, input.end);
  const spentMinor = roundedMinor(input.summary.expenseMinor);
  const base = { period: 'week' as const, label, key: input.start };
  if (spentMinor <= 0) {
    return { ...base, beats: [{ kind: 'final', title: 'A quiet week. Nothing went out.' }] };
  }
  const days = fillDays(input.start, input.end, input.daily);
  const beats: WrapBeat[] = [
    { kind: 'hook', kicker: 'Your week, wrapped', title: label, spentMinor },
    {
      kind: 'weekDays',
      days,
      heaviest: heaviestOf(days),
      quietDays: days.filter((d) => d.totalMinor === 0).length,
    },
  ];
  const top = toWrapCategories(input.summary)[0] ?? null;
  let closing = 'That was the week.';
  if (input.usualWeekMinor != null && input.usualWeekMinor > 0) {
    const changePct = ((spentMinor - input.usualWeekMinor) / input.usualWeekMinor) * 100;
    beats.push({ kind: 'usual', changePct, top });
    closing =
      changePct <= -USUAL_BAND_PCT
        ? 'A lighter week.'
        : changePct >= USUAL_BAND_PCT
          ? 'A bigger week.'
          : 'A steady week.';
  }
  beats.push({ kind: 'final', title: closing });
  return { ...base, beats };
}

/** How many earlier weeks make up "a usual week". */
export const USUAL_WEEKS = 4;

/** The usual week: the average spend of the weeks before `start` that had any, or null when none did. */
export function usualWeekFrom(start: string, daily: DailyExpensePoint[]): number | null {
  const weeks: number[] = [];
  for (let w = 1; w <= USUAL_WEEKS; w++) {
    const from = addDaysToIsoDate(start, -7 * w);
    const to = addDaysToIsoDate(from, 6);
    const total = daily.filter((d) => d.date >= from && d.date <= to).reduce((s, d) => s + d.totalMinor, 0);
    if (total > 0) weeks.push(total);
  }
  return weeks.length > 0 ? roundedMinor(weeks.reduce((s, t) => s + t, 0) / weeks.length) : null;
}

/** Last month's Wrap — what Home's Wrap button plays on the 1st–7th. */
export async function loadMonthWrap(today: Date = new Date()): Promise<Wrap | null> {
  const cursor = { granularity: 'month' as const, offset: -1 };
  const range = periodRange(cursor, today);
  // A Wrap is made to be shown (and shared), so it follows "hide savings & investment amounts".
  const hide = getCachedHideSensitiveAmounts();
  const [rawComparison, daily] = await Promise.all([
    getRangeComparison(range, previousPeriodRange(cursor, today), 'month'),
    getDailyExpenseTotals(range, hide),
  ]);
  const comparison = privateComparison(rawComparison, hide);
  return buildMonthWrap({ monthStart: range.start, monthEnd: range.end, comparison, daily });
}

/** The last full week's Wrap — what Home's Wrap button and the Monday notification play. */
export async function loadWeekWrap(today: Date = new Date()): Promise<Wrap> {
  const { start, end } = lastFullWeek(today);
  const historyStart = addDaysToIsoDate(start, -7 * USUAL_WEEKS);
  const hide = getCachedHideSensitiveAmounts();
  const [rawSummary, daily] = await Promise.all([
    getPeriodSummary({ start, end }),
    getDailyExpenseTotals({ start: historyStart, end }, hide),
  ]);
  const summary = privateSummary(rawSummary, hide);
  return buildWeekWrap({
    start,
    end,
    summary,
    daily: daily.filter((d) => d.date >= start),
    usualWeekMinor: usualWeekFrom(start, daily),
  });
}
