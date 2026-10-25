import type { EntryMonth } from '@/db/exportSummary';
import { ReportPeriod, latestPeriod } from '@/lib/report/period';

const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** How many entries and how much spending the chosen period holds, for the line above the button. */
export function previewFor(
  months: EntryMonth[],
  period: ReportPeriod
): { count: number; spentMinor: number } {
  const inside = months.filter((m) =>
    period.kind === 'all'
      ? true
      : period.kind === 'year'
        ? m.month.startsWith(`${period.year}-`)
        : m.month === ym(period.year, period.month)
  );
  return {
    count: inside.reduce((n, m) => n + m.count, 0),
    spentMinor: Math.max(
      0,
      inside.reduce((n, m) => n + m.spentMinor, 0)
    ),
  };
}

/** The next older (-1) or newer (+1) month or year that has entries, or null at the end of the ledger. */
export function stepPeriod(months: EntryMonth[], period: ReportPeriod, dir: -1 | 1): ReportPeriod | null {
  if (period.kind === 'all') return null;
  if (period.kind === 'month') {
    const list = months.map((m) => m.month).sort(); // oldest first
    const at = list.indexOf(ym(period.year, period.month));
    const next = list[at + dir];
    return at < 0 || !next
      ? null
      : { kind: 'month', year: Number(next.slice(0, 4)), month: Number(next.slice(5)) };
  }
  const years = [...new Set(months.map((m) => Number(m.month.slice(0, 4))))].sort((a, b) => a - b);
  const next = years[years.indexOf(period.year) + dir];
  return years.indexOf(period.year) < 0 || next == null ? null : { kind: 'year', year: next };
}

/** The period to show when the kind switches: the latest month or year with entries. */
export function openPeriod(months: EntryMonth[], kind: ReportPeriod['kind'], today: string): ReportPeriod {
  return latestPeriod(
    kind,
    months.map((m) => `${m.month}-01`),
    today
  );
}
