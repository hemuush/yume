import { parseLocalIsoDate } from '@/lib/date';

/** One day on Home's rail: what was spent, and whether it has happened yet. */
export interface RailDay {
  day: number;
  date: string;
  spentMinor: number;
  elapsed: boolean;
}

export interface Rail {
  days: RailDay[];
  /** Today's day of the month: the last day that can be travelled to. */
  todayDay: number;
}

/** The month `today` is in, one entry per day; days after today carry nothing. `daily` may cover other months. */
export function buildRail(daily: readonly { date: string; totalMinor: number }[], today: string): Rail {
  const [year, month, todayDay] = today.split('-').map(Number);
  const length = new Date(year, month, 0).getDate();
  const prefix = today.slice(0, 7);
  const byDate = new Map(daily.map((d) => [d.date, d.totalMinor]));
  const days = Array.from({ length }, (_, i): RailDay => {
    const day = i + 1;
    const date = `${prefix}-${String(day).padStart(2, '0')}`;
    const elapsed = day <= todayDay;
    return { day, date, spentMinor: elapsed ? Math.max(0, byDate.get(date) ?? 0) : 0, elapsed };
  });
  return { days, todayDay };
}

/** Spending after `day`, up to today: put back, it turns the headline into what was left on that day. */
export function spentAfterDay(rail: Rail, day: number): number {
  return rail.days.reduce((sum, d) => (d.day > day && d.elapsed ? sum + d.spentMinor : sum), 0);
}

/**
 * Each day's tick height as 0–1. Square-root scaled and capped at the 90th-percentile day, so one big
 * payment (rent) doesn't flatten every ordinary day into nothing. 0 for a day with nothing spent.
 */
export function tickLevels(rail: Rail): number[] {
  const spends = rail.days
    .filter((d) => d.spentMinor > 0)
    .map((d) => d.spentMinor)
    .sort((a, b) => a - b);
  const cap = spends.length ? spends[Math.floor((spends.length - 1) * 0.9)] : 1;
  return rail.days.map((d) => (d.spentMinor > 0 ? Math.min(1, Math.sqrt(d.spentMinor / cap)) : 0));
}

/** "7 Oct" for a rail day. */
export function railDayLabel(rail: Rail, day: number): string {
  const date = rail.days[Math.min(Math.max(day, 1), rail.days.length) - 1].date;
  return parseLocalIsoDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
