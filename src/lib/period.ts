import type { DateRange } from '@/types';
import { toLocalIsoDate, addDaysToIsoDate, addMonthsToIsoDate, parseLocalIsoDate } from './date';

export type PeriodGranularity = 'month' | 'year';

/**
 * A browsable point in time: which calendar month/year the user is currently
 * looking at, expressed as an offset from today rather than an absolute date
 * so "step back one" is always correct across year boundaries and month
 * lengths. Shared by Home, Reports and Transactions so all three agree on
 * what "the period you're looking at" means.
 */
export interface PeriodCursor {
  granularity: PeriodGranularity;
  /** 0 = the current month/year, -1 = the previous one, and so on. */
  offset: number;
}

export const CURRENT_PERIOD: PeriodCursor = { granularity: 'month', offset: 0 };

function anchorDate(cursor: PeriodCursor, reference: Date): Date {
  return cursor.granularity === 'month'
    ? new Date(reference.getFullYear(), reference.getMonth() + cursor.offset, 1)
    : new Date(reference.getFullYear() + cursor.offset, 0, 1);
}

/** The inclusive YYYY-MM-DD range the cursor covers. */
export function periodRange(cursor: PeriodCursor, reference: Date = new Date()): DateRange {
  const anchor = anchorDate(cursor, reference);
  if (cursor.granularity === 'month') {
    return {
      start: toLocalIsoDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
      end: toLocalIsoDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
    };
  }
  return {
    start: toLocalIsoDate(new Date(anchor.getFullYear(), 0, 1)),
    end: toLocalIsoDate(new Date(anchor.getFullYear(), 11, 31)),
  };
}

/** The equivalent range one step earlier — what the current period is compared against. */
export function previousPeriodRange(cursor: PeriodCursor, reference: Date = new Date()): DateRange {
  return periodRange({ ...cursor, offset: cursor.offset - 1 }, reference);
}

export function periodLabel(cursor: PeriodCursor, reference: Date = new Date()): string {
  const anchor = anchorDate(cursor, reference);
  if (cursor.granularity === 'year') return String(anchor.getFullYear());
  const thisYear = anchor.getFullYear() === reference.getFullYear();
  return anchor.toLocaleDateString(
    undefined,
    thisYear ? { month: 'long' } : { month: 'long', year: 'numeric' }
  );
}

/** Short label for the period one step back, used in "vs …" comparison text. */
export function previousPeriodLabel(cursor: PeriodCursor): string {
  return cursor.granularity === 'year' ? 'last year' : 'the month before';
}

/** Stepping forward past the current month/year would only ever show an empty future. */
export function canStepForward(cursor: PeriodCursor): boolean {
  return cursor.offset < 0;
}

export function stepPeriod(cursor: PeriodCursor, delta: -1 | 1): PeriodCursor {
  if (delta === 1 && !canStepForward(cursor)) return cursor;
  return { ...cursor, offset: cursor.offset + delta };
}

/**
 * Switching month↔year resets to the current period rather than trying to
 * translate the offset — "3 months back" has no meaningful year equivalent,
 * and silently landing on 2023 would be more surprising than landing on today.
 */
export function setGranularity(cursor: PeriodCursor, granularity: PeriodGranularity): PeriodCursor {
  if (cursor.granularity === granularity) return cursor;
  return { granularity, offset: 0 };
}

/**
 * A range the person picked themselves on Reports ("Custom") — a trip, the
 * last 30 days, a financial year. Both ends inclusive, YYYY-MM-DD.
 */
export interface CustomRange {
  granularity: 'custom';
  start: string;
  end: string;
}

/** What Reports and a category page look at: a month or year by offset, or a custom range. */
export type ReportWindow = PeriodCursor | CustomRange;

export const isCustomWindow = (w: ReportWindow): w is CustomRange => w.granularity === 'custom';

/** Whole calendar months from `start` to `end`, or null when either end falls mid-month. */
function wholeMonths(start: string, end: string): number | null {
  if (start.slice(8) !== '01') return null;
  if (addDaysToIsoDate(end, 1).slice(8) !== '01') return null;
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

/** Days in an inclusive range. */
export function rangeDays(range: DateRange): number {
  return (
    Math.round(
      (parseLocalIsoDate(range.end).getTime() - parseLocalIsoDate(range.start).getTime()) / 86400000
    ) + 1
  );
}

export function windowRange(w: ReportWindow, reference: Date = new Date()): DateRange {
  return isCustomWindow(w) ? { start: w.start, end: w.end } : periodRange(w, reference);
}

/**
 * A custom range moved by its own length: whole months step by that many
 * months (so a financial year steps to the next financial year, and
 * "last 3 months" to the 3 before), anything else by its number of days.
 */
export function shiftCustomRange(range: CustomRange, delta: -1 | 1): CustomRange {
  const months = wholeMonths(range.start, range.end);
  if (months != null) {
    const start = addMonthsToIsoDate(range.start, delta * months);
    const end = addDaysToIsoDate(addMonthsToIsoDate(start, months), -1);
    return { granularity: 'custom', start, end };
  }
  const days = rangeDays(range);
  return {
    granularity: 'custom',
    start: addDaysToIsoDate(range.start, delta * days),
    end: addDaysToIsoDate(range.end, delta * days),
  };
}

/** The window one step earlier — what the current one is compared against. */
export function previousWindowRange(w: ReportWindow, reference: Date = new Date()): DateRange {
  return isCustomWindow(w) ? windowRange(shiftCustomRange(w, -1)) : previousPeriodRange(w, reference);
}

/** A custom range can step forward while its next step still starts on or before today. */
export function canStepWindowForward(w: ReportWindow, today: string = toLocalIsoDate(new Date())): boolean {
  return isCustomWindow(w) ? shiftCustomRange(w, 1).start <= today : canStepForward(w);
}

export function stepWindow(
  w: ReportWindow,
  delta: -1 | 1,
  today: string = toLocalIsoDate(new Date())
): ReportWindow {
  if (!isCustomWindow(w)) return stepPeriod(w, delta);
  if (delta === 1 && !canStepWindowForward(w, today)) return w;
  return shiftCustomRange(w, delta);
}

/** India's financial year (1 Apr – 31 Mar) that `iso` falls in, as its starting year. */
export function financialYearOf(iso: string): number {
  const [y, m] = iso.split('-').map(Number);
  return m >= 4 ? y : y - 1;
}

/** The financial year starting 1 Apr of `startYear`. */
export function financialYearRange(startYear: number): CustomRange {
  return { granularity: 'custom', start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` };
}

const dayMonth = (iso: string, withYear: boolean) =>
  parseLocalIsoDate(iso).toLocaleDateString(
    undefined,
    withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }
  );

/** "FY 2026–27", "Sep 2026", "1 Apr – 26 Sep 2026", or "20 Dec 2025 – 4 Jan 2026". */
export function customRangeLabel(range: DateRange): string {
  const months = wholeMonths(range.start, range.end);
  const startYear = Number(range.start.slice(0, 4));
  if (months === 12 && range.start.slice(5) === '04-01') {
    return `FY ${startYear}–${String((startYear + 1) % 100).padStart(2, '0')}`;
  }
  if (months === 1) {
    return parseLocalIsoDate(range.start).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  if (range.start === range.end) return dayMonth(range.start, true);
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  return `${dayMonth(range.start, !sameYear)} – ${dayMonth(range.end, true)}`;
}

export function windowLabel(w: ReportWindow, reference: Date = new Date()): string {
  return isCustomWindow(w) ? customRangeLabel(w) : periodLabel(w, reference);
}
