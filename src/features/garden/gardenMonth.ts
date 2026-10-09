import { addDaysToIsoDate, parseLocalIsoDate } from '@/lib/date';
import type { DailyGoalStreakPoint } from '@/db/reports';

/** One day on the garden's month calendar. */
export interface GardenDay {
  date: string;
  day: number;
  /** Kept under the goal; missed; before the first expense; or still to come. */
  state: 'kept' | 'missed' | 'untracked' | 'future';
  /** How long the streak was that day, for a deeper green on a long run. */
  streakDays: number;
  today: boolean;
}

export interface GardenMonth {
  /** Blank cells before the 1st, so the grid starts on a Monday. */
  lead: number;
  days: GardenDay[];
  kept: number;
  /** Days so far that counted (tracked, up to today). */
  counted: number;
}

/** A week-long streak or more shows deeper. */
export const DEEP_STREAK = 7;

/**
 * This month as a calendar of kept days, from the streak series (which must reach back to the 1st). Pure:
 * `today` is an input.
 */
export function buildGardenMonth(series: DailyGoalStreakPoint[], today: string): GardenMonth {
  const t = parseLocalIsoDate(today);
  const first = new Date(t.getFullYear(), t.getMonth(), 1);
  const daysInMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const firstIso = addDaysToIsoDate(today, 1 - t.getDate());
  const byDate = new Map(series.map((p) => [p.date, p]));
  const days: GardenDay[] = [];
  let kept = 0;
  let counted = 0;
  for (let i = 0; i < daysInMonth; i++) {
    const date = addDaysToIsoDate(firstIso, i);
    const point = byDate.get(date);
    let state: GardenDay['state'];
    if (date > today) state = 'future';
    else if (!point || point.tracked === false) state = 'untracked';
    else state = point.streakDays > 0 ? 'kept' : 'missed';
    if (state === 'kept') kept++;
    if (state === 'kept' || state === 'missed') counted++;
    days.push({ date, day: i + 1, state, streakDays: point?.streakDays ?? 0, today: date === today });
  }
  // getDay(): Sunday 0 … Saturday 6; the grid starts on Monday.
  const lead = (first.getDay() + 6) % 7;
  return { lead, days, kept, counted };
}
