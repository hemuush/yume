import { parseLocalIsoDate } from './date';

/**
 * The app's date labels, in the phone's locale ("5 Oct" in India, "Oct 5" in the US).
 * Each takes a local calendar date (never a timestamp) and parses it as local time (see parseLocalIsoDate).
 */

/**
 * One label: its formatter is made when it is first used (building one is the slow part of formatting a date, and a
 * list of days built one every time), and the labels of dates already shown are kept, so a list that draws again does
 * not format them again. The same text as `toLocaleDateString(undefined, options)`, which every option set here
 * names a date part for.
 */
const label = (options: Intl.DateTimeFormatOptions) => {
  let formatter: Intl.DateTimeFormat | undefined;
  const shown = new Map<string, string>();
  return (iso: string): string => {
    const hit = shown.get(iso);
    if (hit !== undefined) return hit;
    formatter ??= new Intl.DateTimeFormat(undefined, options);
    const text = formatter.format(parseLocalIsoDate(iso));
    // A long-lived app sees many dates; keep the recent ones, not all of them.
    if (shown.size >= 500) shown.clear();
    shown.set(iso, text);
    return text;
  };
};

/** "5 Oct" */
export const dayMonth = label({ day: 'numeric', month: 'short' });

/** "5 Oct 2026" */
export const dayMonthYear = label({ day: 'numeric', month: 'short', year: 'numeric' });

/**
 * "5 Oct", and "5 Oct 2025" once the date is not in this year: for a date that may be long past (an old entry
 * Tidy up or Recently deleted lists), where "5 Oct" alone could be either of two years.
 */
export const dayMonthMaybeYear = (iso: string, today: Date = new Date()) =>
  iso.slice(0, 4) === String(today.getFullYear()) ? dayMonth(iso) : dayMonthYear(iso);

/** "Thu 1 Oct" */
export const weekdayDayMonth = label({ weekday: 'short', day: 'numeric', month: 'short' });

/** "Thu 1 Oct 2026" */
export const weekdayDayMonthYear = label({
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * "Thu 1 Oct", and "Thu 1 Oct 2027" once the date is not in this year: for a date that can be far off or long past
 * (a yearly bill, a loan's next EMI, an old entry), where "Tue 3 Mar" alone could be either of two years.
 */
export const weekdayDayMonthMaybeYear = (iso: string, today: Date = new Date()) =>
  iso.slice(0, 4) === String(today.getFullYear()) ? weekdayDayMonth(iso) : weekdayDayMonthYear(iso);

/** "Thursday" */
/** "THU": the short weekday, for a day's marker in Activity's feed. */
export const shortWeekday = label({ weekday: 'short' });
export const longWeekday = label({ weekday: 'long' });

/** "Oct" */
export const shortMonth = label({ month: 'short' });

/** "October" */
export const longMonth = label({ month: 'long' });

/** "Oct 2026" */
export const shortMonthYear = label({ month: 'short', year: 'numeric' });

/** "October 2026" */
export const longMonthYear = label({ month: 'long', year: 'numeric' });
