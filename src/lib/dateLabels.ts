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

/** "Thu 1 Oct" */
export const weekdayDayMonth = (iso: string) =>
  fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });

/** "Thursday" */
export const longWeekday = (iso: string) => fmt(iso, { weekday: 'long' });

/** "Oct" */
export const shortMonth = (iso: string) => fmt(iso, { month: 'short' });

/** "October" */
export const longMonth = (iso: string) => fmt(iso, { month: 'long' });

/** "Oct 2026" */
export const shortMonthYear = (iso: string) => fmt(iso, { month: 'short', year: 'numeric' });

/** "October 2026" */
export const longMonthYear = (iso: string) => fmt(iso, { month: 'long', year: 'numeric' });
