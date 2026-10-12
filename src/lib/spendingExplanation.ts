import { DateRange } from '@/types';
import { addDaysToIsoDate, parseLocalIsoDate } from './date';
export interface SpendingFacts {
  grossMinor: number;
  refundMinor: number;
  count: number;
}
/** Exact symmetric decomposition of gross spending; refund changes remain a separate term. */
export function explainSpending(current: SpendingFacts, previous: SpendingFacts) {
  const currentAverage = current.count ? current.grossMinor / current.count : 0;
  const previousAverage = previous.count ? previous.grossMinor / previous.count : 0;
  const deltaMinor = current.grossMinor - current.refundMinor - previous.grossMinor + previous.refundMinor;
  let frequencyMinor: number, sizeMinor: number;
  if (!previous.count || !current.count) {
    frequencyMinor = current.grossMinor - previous.grossMinor;
    sizeMinor = 0;
  } else {
    frequencyMinor = Math.round(((current.count - previous.count) * (currentAverage + previousAverage)) / 2);
    sizeMinor = current.grossMinor - previous.grossMinor - frequencyMinor;
  }
  return {
    deltaMinor,
    frequencyMinor,
    sizeMinor,
    refundsMinor: previous.refundMinor - current.refundMinor,
    currentAverage,
    previousAverage,
    newCategory: previous.count === 0,
  };
}
export function matchedSpendingRanges(current: DateRange, previous: DateRange, today: string) {
  const elapsedEnd = current.end < today ? current.end : today;
  if (elapsedEnd < current.start) throw new Error('This period has not started yet.');
  const length = (start: string, end: string) =>
    Math.round((parseLocalIsoDate(end).getTime() - parseLocalIsoDate(start).getTime()) / 86400000) + 1;
  const days = Math.min(length(current.start, elapsedEnd), length(previous.start, previous.end));
  if (days < 1) throw new Error('No comparable days in this range.');
  return {
    current: { start: current.start, end: addDaysToIsoDate(current.start, days - 1) },
    previous: { start: previous.start, end: addDaysToIsoDate(previous.start, days - 1) },
    days,
  };
}
