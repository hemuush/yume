import { parseLocalIsoDate } from './date';

/**
 * The app's date labels, in the phone's locale ("5 Oct" in India, "Oct 5" in the US).
 * Each takes a local calendar date (never a timestamp) and parses it as local time (see parseLocalIsoDate).
 */

const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  parseLocalIsoDate(iso).toLocaleDateString(undefined, options);

/** "5 Oct" */
export const dayMonth = (iso: string) => fmt(iso, { day: 'numeric', month: 'short' });

/** "5 Oct 2026" */
export const dayMonthYear = (iso: string) => fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * "5 Oct", and "5 Oct 2025" once the date is not in this year: for a date that may be long past (an old entry
 * Tidy up or Recently deleted lists), where "5 Oct" alone could be either of two years.
 */
export const dayMonthMaybeYear = (iso: string, today: Date = new Date()) =>
  iso.slice(0, 4) === String(today.getFullYear()) ? dayMonth(iso) : dayMonthYear(iso);

/** "Thu 1 Oct" */
export const weekdayDayMonth = (iso: string) =>
  fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });

/** "Thu 1 Oct 2026" */
export const weekdayDayMonthYear = (iso: string) =>
  fmt(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/**
 * "Thu 1 Oct", and "Thu 1 Oct 2027" once the date is not in this year: for a date that can be far off or long past
 * (a yearly bill, a loan's next EMI, an old entry), where "Tue 3 Mar" alone could be either of two years.
 */
export const weekdayDayMonthMaybeYear = (iso: string, today: Date = new Date()) =>
  iso.slice(0, 4) === String(today.getFullYear()) ? weekdayDayMonth(iso) : weekdayDayMonthYear(iso);

/** "Thursday" */
/** "THU": the short weekday, for a day's marker in Activity's feed. */
export const shortWeekday = (iso: string) => fmt(iso, { weekday: 'short' });
export const longWeekday = (iso: string) => fmt(iso, { weekday: 'long' });

/** "Oct" */
export const shortMonth = (iso: string) => fmt(iso, { month: 'short' });

/** "October" */
export const longMonth = (iso: string) => fmt(iso, { month: 'long' });

/** "Oct 2026" */
export const shortMonthYear = (iso: string) => fmt(iso, { month: 'short', year: 'numeric' });

/** "October 2026" */
export const longMonthYear = (iso: string) => fmt(iso, { month: 'long', year: 'numeric' });
