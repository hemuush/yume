import type { RecurrenceFrequency } from '@/types';
import { addDaysToIsoDate, addMonthsToIsoDate } from './date';

/**
 * One step of a repeating rule's cadence (every 2 weeks = 14 days). `anchorDay` is the rule's real day-of-month:
 * steps chain from the previous (clamped) date, so without it a 31st rule would ride Feb 28 → Mar 28 forever.
 */
export function advanceDate(
  date: string,
  frequency: RecurrenceFrequency,
  intervalCount: number,
  anchorDay: number
): string {
  switch (frequency) {
    case 'daily':
      return addDaysToIsoDate(date, intervalCount);
    case 'weekly':
      return addDaysToIsoDate(date, intervalCount * 7);
    case 'monthly':
      return addMonthsToIsoDate(date, intervalCount, anchorDay);
    case 'yearly':
      return addMonthsToIsoDate(date, intervalCount * 12, anchorDay);
  }
}

/**
 * How many times a rule runs after `after` and up to `through` (inclusive), starting from its next run and
 * stopping at its end date. A weekly bill runs four or five times in a month, not once.
 */
export function runsBetween(
  rule: {
    nextRunDate: string;
    frequency: RecurrenceFrequency;
    intervalCount: number;
    anchorDay: number;
    endDate: string | null;
    scheduledDate?: string | null;
  },
  after: string,
  through: string
): number {
  let runs = 0;
  let cursor = rule.nextRunDate;
  // Bounded: a daily rule over one month is ~31 steps; a broken interval can't spin forever.
  for (let i = 0; i < 400 && cursor <= through; i++) {
    if (rule.endDate && cursor > rule.endDate) break;
    if (cursor > after) runs++;
    cursor = advanceOccurrence(rule, cursor);
  }
  return runs;
}

/** A one-off postponement never becomes the anchor for later occurrences. */
export function advanceOccurrence(
  rule: {
    nextRunDate: string;
    scheduledDate?: string | null;
    frequency: RecurrenceFrequency;
    intervalCount: number;
    anchorDay?: number | null;
  },
  cursor: string
): string {
  const base = cursor === rule.nextRunDate ? (rule.scheduledDate ?? cursor) : cursor;
  return advanceDate(
    base,
    rule.frequency,
    Math.max(1, rule.intervalCount),
    rule.anchorDay ?? Number(base.slice(8))
  );
}
