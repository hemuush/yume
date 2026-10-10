import { addDaysToIsoDate, parseLocalIsoDate } from '@/lib/date';

export interface SpendBar {
  key: string;
  label: string;
  totalMinor: number;
  /** Today, or the week today is in: drawn dark with its amount on top. */
  current: boolean;
}

/** The first day Home's bars need: a week back or the 1st of the month, whichever is earlier. */
export function spendBarsStart(today: string): string {
  const weekAgo = addDaysToIsoDate(today, -6);
  const monthStart = `${today.slice(0, 7)}-01`;
  return weekAgo < monthStart ? weekAgo : monthStart;
}

const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The last seven days, oldest first, each labelled by its weekday's letter; today is the last. */
export function weekBars(daily: { date: string; totalMinor: number }[], today: string): SpendBar[] {
  const byDate = new Map(daily.map((d) => [d.date, d.totalMinor]));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToIsoDate(today, i - 6);
    return {
      key: date,
      label: DAY_LETTER[parseLocalIsoDate(date).getDay()],
      totalMinor: byDate.get(date) ?? 0,
      current: i === 6,
    };
  });
}

/** This month in weeks of seven days from the 1st (W1 = 1–7 … W5 = 29 to the end), up to today's week. */
export function monthBars(daily: { date: string; totalMinor: number }[], today: string): SpendBar[] {
  const month = today.slice(0, 7);
  const todayWeek = Math.floor((Number(today.slice(8, 10)) - 1) / 7);
  const totals = Array.from({ length: todayWeek + 1 }, () => 0);
  for (const d of daily) {
    if (d.date.slice(0, 7) !== month || d.date > today) continue;
    totals[Math.floor((Number(d.date.slice(8, 10)) - 1) / 7)] += d.totalMinor;
  }
  return totals.map((totalMinor, i) => ({
    key: `w${i + 1}`,
    label: `W${i + 1}`,
    totalMinor,
    current: i === todayWeek,
  }));
}
