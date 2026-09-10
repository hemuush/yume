import { parseLocalIsoDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import type { CategoryBreakdownItem, DailyExpensePoint, TrendPoint } from '@/db/reports';

/** Which categories count as a fixed monthly load rather than a choice. */
export const FIXED_CATEGORY_NAMES = ['Loan EMI', 'Rent', 'Insurance', 'Subscriptions'];

/** Bucket a day's spend into one of 5 heat levels (0 = none). `max` is the heaviest day. */
export function heatLevel(amountMinor: number, maxMinor: number): 0 | 1 | 2 | 3 | 4 {
  if (amountMinor <= 0) return 0;
  if (maxMinor <= 0) return 1;
  const r = amountMinor / maxMinor;
  if (r > 0.66) return 4;
  if (r > 0.33) return 3;
  if (r > 0.12) return 2;
  return 1;
}

/** Rolling average of the prior months in a monthly trend (excludes the last / current point). */
export function baselineFromTrend(trend: TrendPoint[]): number | null {
  const prior = trend.slice(0, -1).map((t) => t.totalMinor);
  if (prior.length < 2) return null;
  return prior.reduce((a, b) => a + b, 0) / prior.length;
}

/** Split this period's category spend into the fixed load vs. everything else. */
export function recurringVsDiscretionary(breakdown: CategoryBreakdownItem[]): {
  recurringMinor: number;
  discretionaryMinor: number;
} {
  let recurringMinor = 0;
  let discretionaryMinor = 0;
  for (const c of breakdown) {
    if (FIXED_CATEGORY_NAMES.includes(c.name)) recurringMinor += c.totalMinor;
    else discretionaryMinor += c.totalMinor;
  }
  return { recurringMinor, discretionaryMinor };
}

/** Per-category % change vs the same category last period, keyed by categoryId. */
export function categoryDeltas(
  current: CategoryBreakdownItem[],
  previous: CategoryBreakdownItem[]
): Map<string, number | null> {
  const prev = new Map(previous.map((c) => [c.categoryId, c.totalMinor]));
  const out = new Map<string, number | null>();
  for (const c of current) {
    const p = prev.get(c.categoryId) ?? 0;
    out.set(c.categoryId, p === 0 ? null : ((c.totalMinor - p) / p) * 100);
  }
  return out;
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * One-to-three plain-language reads of a month's daily-spend shape. Only the
 * genuinely notable ones are returned — a flat month gets fewer lines.
 */
export function describeSpendingPattern(daily: DailyExpensePoint[], totalDaysInPeriod: number): string[] {
  const spent = daily.filter((d) => d.totalMinor > 0);
  if (spent.length < 3) return [];

  const lines: string[] = [];

  // 1 — heaviest day
  const heaviest = spent.reduce((a, b) => (b.totalMinor > a.totalMinor ? b : a));
  const hd = parseLocalIsoDate(heaviest.date);
  const heaviestShare = heaviest.totalMinor / spent.reduce((s, d) => s + d.totalMinor, 0);
  if (heaviestShare > 0.2) {
    lines.push(
      `Heaviest day was ${hd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} — ${formatMoney(heaviest.totalMinor)}, ${Math.round(heaviestShare * 100)}% of the month.`
    );
  }

  // 2 — front-loaded (bills week)
  const firstWeek = spent
    .filter((d) => parseLocalIsoDate(d.date).getDate() <= 8)
    .reduce((s, d) => s + d.totalMinor, 0);
  const total = spent.reduce((s, d) => s + d.totalMinor, 0);
  if (total > 0 && firstWeek / total > 0.55) {
    lines.push(`${Math.round((firstWeek / total) * 100)}% of the month was spent in the first 8 days.`);
  }

  // 3 — weekday vs weekend
  const wk = { wdSum: 0, wdN: 0, weSum: 0, weN: 0 };
  for (const d of daily) {
    const day = parseLocalIsoDate(d.date).getDay();
    if (day === 0 || day === 6) {
      wk.weSum += d.totalMinor;
      wk.weN += 1;
    } else {
      wk.wdSum += d.totalMinor;
      wk.wdN += 1;
    }
  }
  if (wk.weN > 0 && wk.wdN > 0) {
    const wdAvg = wk.wdSum / wk.wdN;
    const weAvg = wk.weSum / wk.weN;
    if (wdAvg > 0 && weAvg < wdAvg * 0.6) {
      lines.push(`Weekends run ${Math.round((1 - weAvg / wdAvg) * 100)}% below your weekday average.`);
    } else if (weAvg > wdAvg * 1.4) {
      lines.push(`Weekends run ${Math.round((weAvg / wdAvg - 1) * 100)}% above your weekday average.`);
    }
  }

  // 4 — quiet stretch (fallback so there's usually at least one line)
  if (lines.length === 0) {
    const noSpend = totalDaysInPeriod - spent.length;
    if (noSpend >= 3) lines.push(`${noSpend} no-spend days this period.`);
  }

  // 5 — busiest weekday
  if (lines.length < 3) {
    const byDow = new Array(7).fill(0);
    for (const d of daily) byDow[parseLocalIsoDate(d.date).getDay()] += d.totalMinor;
    const maxDow = byDow.indexOf(Math.max(...byDow));
    if (byDow[maxDow] > 0) lines.push(`${WEEKDAY[maxDow]}s are your biggest spending day.`);
  }

  return lines.slice(0, 3);
}
