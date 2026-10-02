/**
 * Local calendar date as YYYY-MM-DD, built from the Date's own local
 * year/month/day fields — never via toISOString(), which converts to UTC
 * first and silently rolls the date back a day for any positive UTC-offset
 * timezone (e.g. India, UTC+5:30) whenever local time hasn't yet caught up
 * to UTC midnight.
 */
export function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds whole months to a YYYY-MM-DD date, entirely in local-calendar space
 * (no UTC parsing/round-trip). `new Date(isoString)` parses date-only ISO
 * strings as UTC midnight, which — mixed with local getMonth/setMonth — can
 * shift the result by a day depending on the device's timezone offset; this
 * avoids that entirely by building the target date from plain numbers.
 *
 * A day that doesn't exist in the target month is clamped to that month's
 * last day (Jan 31 + 1 month = Feb 28/29), never overflowed into the next
 * month the way `new Date(y, m, 31)` does — overflow previously gave a
 * Jan-31 loan no February EMI and two in March, and walked a monthly rule on
 * the 31st permanently onto the 3rd.
 *
 * `anchorDay` is for callers that step a schedule forward one period at a
 * time from an already-clamped date: without it, Jan 31 → Feb 28 → Mar 28
 * would lose the real due day for good. Passing the schedule's original day
 * (31) makes that Feb 28 → Mar 31 instead. Defaults to `isoDate`'s own day.
 */
export function addMonthsToIsoDate(isoDate: string, months: number, anchorDay?: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const firstOfTarget = new Date(year, month - 1 + months, 1);
  const targetYear = firstOfTarget.getFullYear();
  const targetMonth = firstOfTarget.getMonth();
  const lastDayOfTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
  return toLocalIsoDate(new Date(targetYear, targetMonth, Math.min(anchorDay ?? day, lastDayOfTarget)));
}

/** The day-of-month (1–31) of a YYYY-MM-DD date — the `anchorDay` a schedule keeps across clamped months. */
export function dayOfIsoDate(isoDate: string): number {
  return Number(isoDate.split('-')[2]);
}

/**
 * The first date after `today` on the same day of the month as `isoDate`
 * — where a monthly rule made from a past entry should next run (a 31st
 * lands on each month's last day, like the rules themselves).
 */
export function nextMonthlyDateAfter(isoDate: string, today: string): string {
  const day = dayOfIsoDate(isoDate);
  let next = addMonthsToIsoDate(isoDate, 1, day);
  while (next <= today) next = addMonthsToIsoDate(next, 1, day);
  return next;
}

/**
 * Adds whole days to a YYYY-MM-DD date, entirely in local-calendar space —
 * same UTC-round-trip pitfall as addMonthsToIsoDate above, avoided the same way.
 */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toLocalIsoDate(new Date(year, month - 1, day + days));
}

/**
 * Parses a YYYY-MM-DD string as local midnight, not UTC midnight — `new
 * Date(isoDateString)` parses it as UTC, which then reads as the previous
 * local calendar day for negative-UTC-offset timezones once local time and
 * hour-of-day math (e.g. `.setHours(0,0,0,0)`) get involved.
 */
export function parseLocalIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Whole calendar months between two YYYY-MM-DD dates (`to` minus `from`),
 * floored — e.g. 2025-09-05 to 2026-09-04 is 11, not 12, since the 12th
 * month hasn't completed yet. Used to sanity-check "installments already
 * paid" against a loan's start date: claiming 50 paid when only 13 months
 * have elapsed since the entered start date means the two numbers don't
 * agree, regardless of which one is wrong.
 */
export function monthsBetweenIsoDates(from: string, to: string): number {
  const a = parseLocalIsoDate(from);
  const b = parseLocalIsoDate(to);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Whole days from local midnight today to the given YYYY-MM-DD date —
 * negative if it's already past, 0 if it's today. Shared by every screen
 * that shows an EMI/bill countdown so they all round the same way.
 */
export function daysUntilIsoDate(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalIsoDate(isoDate);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** "Today", "Yesterday", or a short date like "27 Sep" — a past day said the way a person would. */
export function dayLabel(isoDate: string): string {
  const days = daysUntilIsoDate(isoDate);
  if (days === 0) return 'Today';
  if (days === -1) return 'Yesterday';
  return parseLocalIsoDate(isoDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Every ISO date from `from` to `to` inclusive, in order — used wherever a UI
 * needs one entry per calendar day in a range (e.g. one bar per day in a
 * spend chart), rather than each caller re-deriving it with its own loop.
 */
/** Whether a route param (or any string) is a plain YYYY-MM-DD date. */
export function isIsoDate(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function isoDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return dates;
}
