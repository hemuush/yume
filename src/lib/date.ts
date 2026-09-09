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
 */
export function addMonthsToIsoDate(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toLocalIsoDate(new Date(year, month - 1 + months, day));
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

/**
 * Turns free-typed Day/Month/Year text fields into a YYYY-MM-DD date, or
 * null if the combination isn't a real calendar date (e.g. "31/2/2026").
 * Built from plain numbers rather than `new Date(y, m, d)` alone so an
 * out-of-range day (Feb 30) is rejected instead of silently rolling into
 * the next month.
 */
export function partsToIsoDate(year: string, month: string, day: string): string | null {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return toLocalIsoDate(dt);
}
