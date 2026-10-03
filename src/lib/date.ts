/**
 * Local date as YYYY-MM-DD from local fields, never `toISOString()`: it converts to UTC and rolls the date
 * back a day in positive-offset zones (e.g. India, UTC+5:30) until local time passes UTC midnight.
 */
export function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds whole months in local-calendar space (no UTC parse); a missing day clamps to the month's last day.
 * `anchorDay` (default: isoDate's day) keeps the due day when stepping from a clamped date: Feb 28 -> Mar 31.
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
 * First date after `today` on the same day of the month as `isoDate`: where a monthly rule made from a past
 * entry next runs (a 31st lands on each month's last day).
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
 * Parses a YYYY-MM-DD string as local midnight, not UTC: `new Date(iso)` is UTC and reads as the previous
 * local day in negative-offset zones once hour math like `.setHours(0,0,0,0)` is involved.
 */
export function parseLocalIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Whole calendar months from `from` to `to` (YYYY-MM-DD), floored: 2025-09-05 to 2026-09-04 is 11, not 12.
 * Sanity-checks "installments already paid" against a loan's start date.
 */
export function monthsBetweenIsoDates(from: string, to: string): number {
  const a = parseLocalIsoDate(from);
  const b = parseLocalIsoDate(to);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Whole days from local midnight today to a YYYY-MM-DD date: negative if past, 0 if today.
 * Shared by every EMI/bill countdown so they all round the same way.
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
 * Every ISO date from `from` to `to` inclusive, in order, for UIs needing one entry per calendar day
 * (e.g. a bar per day in a spend chart).
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
