import { DateRange } from '@/db/reports';
import { toLocalIsoDate } from './date';

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
export function previousPeriodLabel(cursor: PeriodCursor, reference: Date = new Date()): string {
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
