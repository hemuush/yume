/**
 * The span an export covers: one month, one year, or everything. Dates are plain `YYYY-MM-DD` strings
 * throughout (the app's own storage format), so comparing them as text is the same as comparing days.
 */
export type ReportPeriod =
  | { kind: 'month'; year: number; month: number } // month is 1–12
  | { kind: 'year'; year: number }
  | { kind: 'all' };

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Monday = 0 … Sunday = 6 for a `YYYY-MM-DD` date. */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Whole days from `a` to `b` (both `YYYY-MM-DD`); negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  const t = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** First and last day of the period; `all` spans the given entry dates (null when there are none). */
export function periodRange(period: ReportPeriod, dates: string[] = []): { from: string; to: string } | null {
  if (period.kind === 'month') {
    const last = daysInMonth(period.year, period.month);
    return {
      from: `${period.year}-${pad(period.month)}-01`,
      to: `${period.year}-${pad(period.month)}-${pad(last)}`,
    };
  }
  if (period.kind === 'year') return { from: `${period.year}-01-01`, to: `${period.year}-12-31` };
  if (!dates.length) return null;
  let from = dates[0].slice(0, 10);
  let to = from;
  for (const d of dates) {
    const day = d.slice(0, 10);
    if (day < from) from = day;
    if (day > to) to = day;
  }
  return { from, to };
}

export function inPeriod(date: string, period: ReportPeriod): boolean {
  const day = date.slice(0, 10);
  if (period.kind === 'all') return true;
  const range = periodRange(period)!;
  return day >= range.from && day <= range.to;
}

export function previousPeriod(period: ReportPeriod): ReportPeriod | null {
  if (period.kind === 'month') {
    return period.month === 1
      ? { kind: 'month', year: period.year - 1, month: 12 }
      : { kind: 'month', year: period.year, month: period.month - 1 };
  }
  if (period.kind === 'year') return { kind: 'year', year: period.year - 1 };
  return null;
}

export function periodLabel(period: ReportPeriod): string {
  if (period.kind === 'month') return `${MONTH_NAMES[period.month - 1]} ${period.year}`;
  if (period.kind === 'year') return String(period.year);
  return 'All time';
}

/** A short label for comparing against: "Aug" within a year, "Aug 2025" across years, "2025" for a year. */
export function previousLabel(period: ReportPeriod): string {
  const prev = previousPeriod(period);
  if (!prev) return '';
  if (prev.kind === 'month') return `${MONTH_SHORT[prev.month - 1]} ${prev.year}`;
  return periodLabel(prev);
}

/** File-name stem: yume-2026-09, yume-2026, yume-all. */
export function periodFileStem(period: ReportPeriod): string {
  if (period.kind === 'month') return `yume-${period.year}-${pad(period.month)}`;
  if (period.kind === 'year') return `yume-${period.year}`;
  return 'yume-all';
}

/** Years with entries (newest first) and, per year, the months with entries (newest first). */
export function availablePeriods(dates: string[]): { years: number[]; months: Map<number, number[]> } {
  const months = new Map<number, Set<number>>();
  for (const d of dates) {
    const year = Number(d.slice(0, 4));
    const month = Number(d.slice(5, 7));
    if (!Number.isFinite(year) || !(month >= 1 && month <= 12)) continue;
    if (!months.has(year)) months.set(year, new Set());
    months.get(year)!.add(month);
  }
  const years = [...months.keys()].sort((a, b) => b - a);
  return {
    years,
    months: new Map(years.map((y) => [y, [...months.get(y)!].sort((a, b) => b - a)])),
  };
}

/** The latest period with entries of the given kind, to open the picker on. */
export function latestPeriod(kind: ReportPeriod['kind'], dates: string[], today: string): ReportPeriod {
  const { years, months } = availablePeriods(dates);
  const thisYear = Number(today.slice(0, 4));
  const year = years[0] ?? thisYear;
  if (kind === 'all') return { kind: 'all' };
  if (kind === 'year') return { kind: 'year', year };
  return { kind: 'month', year, month: months.get(year)?.[0] ?? Number(today.slice(5, 7)) };
}
