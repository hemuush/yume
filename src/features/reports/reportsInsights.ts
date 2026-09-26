import { parseLocalIsoDate, toLocalIsoDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import type { CategoryBreakdownItem, DailyExpensePoint, TrendPoint } from '@/db/reports';
import type { HeatCell } from './SpendHeatmap';

/** Which categories count as a fixed monthly load rather than a choice. */
const FIXED_CATEGORY_NAMES = ['Loan EMI', 'Rent', 'Insurance', 'Subscriptions'];

/**
 * The day-detail popup's footer figure. When the day has any income it shows
 * the net (income − expense, signed); otherwise the plain total spent.
 * Transfers move money between the user's own accounts and never count.
 */
export function summariseDayTotal(txs: { type: 'income' | 'expense' | 'transfer'; amountMinor: number }[]): {
  label: 'Net this day' | 'Total spent';
  amountMinor: number;
  sign: '+' | '−' | '';
} {
  let inMinor = 0;
  let outMinor = 0;
  for (const t of txs) {
    if (t.type === 'income') inMinor += t.amountMinor;
    else if (t.type === 'expense') outMinor += t.amountMinor;
  }
  if (inMinor > 0) {
    const net = inMinor - outMinor;
    return { label: 'Net this day', amountMinor: Math.abs(net), sign: net >= 0 ? '+' : '−' };
  }
  return { label: 'Total spent', amountMinor: outMinor, sign: outMinor > 0 ? '−' : '' };
}

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

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The heatmap's grid for a period. A month is a calendar (7 columns, blank
 * cells before the 1st, today marked, a spend day tappable via
 * `onDayPress`); a year is its 12 months in 4 columns, from `trend`.
 */
export function buildHeatGrid(input: {
  granularity: 'month' | 'year';
  /** First day of the period. */
  start: Date;
  trend: TrendPoint[];
  daily: DailyExpensePoint[];
  onDayPress: (iso: string) => void;
  /** Injectable for tests; defaults to today. */
  todayIso?: string;
}): { cells: HeatCell[]; leadingPad: number; columns: number; weekdayLabels?: string[] } {
  if (input.granularity === 'year') {
    const maxMonth = Math.max(1, ...input.trend.map((t) => t.totalMinor));
    return {
      cells: input.trend.map((t, i) => ({
        key: `m-${i}`,
        label: t.label,
        level: heatLevel(t.totalMinor, maxMonth),
      })),
      leadingPad: 0,
      columns: 4,
    };
  }
  const y = input.start.getFullYear();
  const m = input.start.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const byDate = new Map(input.daily.map((d) => [d.date, d.totalMinor]));
  const maxDay = Math.max(1, ...input.daily.map((d) => d.totalMinor));
  const todayIso = input.todayIso ?? toLocalIsoDate(new Date());
  const cells = Array.from({ length: daysInMonth }, (_, i): HeatCell => {
    const day = i + 1;
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const total = byDate.get(iso) ?? 0;
    return {
      key: iso,
      label: String(day),
      level: heatLevel(total, maxDay),
      isToday: iso === todayIso,
      onPress: total > 0 ? () => input.onDayPress(iso) : undefined,
    };
  });
  return { cells, leadingPad: new Date(y, m, 1).getDay(), columns: 7, weekdayLabels: WEEKDAYS };
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
 * One notable thing about a period's daily-spend shape: `sentence` is the
 * plain-language read (what describeSpendingPattern returns), `kicker` and
 * `big` are the same finding as a story card's label and headline.
 */
export interface PatternFact {
  key: 'heaviest' | 'frontLoaded' | 'weekends' | 'noSpend' | 'busiestDay';
  kicker: string;
  big: string;
  /** The rest of the card, under `big`. */
  detail: string;
  sentence: string;
}

/**
 * The notable reads of a month's daily-spend shape, most telling first, at
 * most three. Only the genuinely notable ones are returned — a flat month
 * gets fewer.
 */
export function patternFacts(daily: DailyExpensePoint[], totalDaysInPeriod: number): PatternFact[] {
  const spent = daily.filter((d) => d.totalMinor > 0);
  if (spent.length < 3) return [];

  const facts: PatternFact[] = [];
  const total = spent.reduce((s, d) => s + d.totalMinor, 0);

  // 1 — heaviest day
  const heaviest = spent.reduce((a, b) => (b.totalMinor > a.totalMinor ? b : a));
  const heaviestShare = heaviest.totalMinor / total;
  if (heaviestShare > 0.2) {
    const day = parseLocalIsoDate(heaviest.date).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    const pct = Math.round(heaviestShare * 100);
    facts.push({
      key: 'heaviest',
      kicker: 'Heaviest day',
      big: day,
      detail: `${formatMoney(heaviest.totalMinor)} went out — ${pct}% of the month in one day.`,
      sentence: `Heaviest day was ${day} — ${formatMoney(heaviest.totalMinor)}, ${pct}% of the month.`,
    });
  }

  // 2 — front-loaded (bills week)
  const firstWeek = spent
    .filter((d) => parseLocalIsoDate(d.date).getDate() <= 8)
    .reduce((s, d) => s + d.totalMinor, 0);
  if (total > 0 && firstWeek / total > 0.55) {
    const pct = Math.round((firstWeek / total) * 100);
    facts.push({
      key: 'frontLoaded',
      kicker: 'Front-loaded',
      big: `${pct}% in 8 days`,
      detail: 'Most of the month went out in its first eight days.',
      sentence: `${pct}% of the month was spent in the first 8 days.`,
    });
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
      const pct = Math.round((1 - weAvg / wdAvg) * 100);
      facts.push({
        key: 'weekends',
        kicker: 'Your rhythm',
        big: `Weekends −${pct}%`,
        detail: 'Saturdays and Sundays ran below your weekday average.',
        sentence: `Weekends run ${pct}% below your weekday average.`,
      });
    } else if (weAvg > wdAvg * 1.4) {
      const pct = Math.round((weAvg / wdAvg - 1) * 100);
      facts.push({
        key: 'weekends',
        kicker: 'Your rhythm',
        big: `Weekends +${pct}%`,
        detail: 'Saturdays and Sundays ran above your weekday average.',
        sentence: `Weekends run ${pct}% above your weekday average.`,
      });
    }
  }

  // 4 — quiet stretch (fallback so there's usually at least one read)
  if (facts.length === 0) {
    const noSpend = totalDaysInPeriod - spent.length;
    if (noSpend >= 3) {
      facts.push({
        key: 'noSpend',
        kicker: 'Quiet days',
        big: `${noSpend} no-spend days`,
        detail: 'Days nothing went out at all.',
        sentence: `${noSpend} no-spend days this period.`,
      });
    }
  }

  // 5 — busiest weekday
  if (facts.length < 3) {
    const byDow = new Array(7).fill(0);
    for (const d of daily) byDow[parseLocalIsoDate(d.date).getDay()] += d.totalMinor;
    const maxDow = byDow.indexOf(Math.max(...byDow));
    if (byDow[maxDow] > 0) {
      facts.push({
        key: 'busiestDay',
        kicker: 'Your rhythm',
        big: `${WEEKDAY[maxDow]}s`,
        detail: 'Your biggest spending day of the week.',
        sentence: `${WEEKDAY[maxDow]}s are your biggest spending day.`,
      });
    }
  }

  return facts.slice(0, 3);
}

/**
 * One-to-three plain-language reads of a month's daily-spend shape. Only the
 * genuinely notable ones are returned — a flat month gets fewer lines.
 */
export function describeSpendingPattern(daily: DailyExpensePoint[], totalDaysInPeriod: number): string[] {
  return patternFacts(daily, totalDaysInPeriod).map((f) => f.sentence);
}

export interface QuietDays {
  /** Days counted so far: the whole period, or up to today for the one in progress. */
  countedDays: number;
  noSpendDays: number;
  /** The longest unbroken run of no-spend days, if any lasted 2+ days. */
  longestRun: { days: number; start: string; end: string } | null;
}

/** How many of the period's days (so far) had no spending at all, and the longest such run. */
export function quietDays(
  daily: DailyExpensePoint[],
  range: { start: string; end: string },
  today: string
): QuietDays {
  const last = today < range.end ? today : range.end;
  const spentOn = new Set(daily.filter((d) => d.totalMinor > 0).map((d) => d.date));
  let countedDays = 0;
  let noSpendDays = 0;
  let run: { days: number; start: string; end: string } | null = null;
  let best: { days: number; start: string; end: string } | null = null;
  for (let d = parseLocalIsoDate(range.start); toLocalIsoDate(d) <= last; d.setDate(d.getDate() + 1)) {
    const iso = toLocalIsoDate(d);
    countedDays++;
    if (spentOn.has(iso)) {
      run = null;
      continue;
    }
    noSpendDays++;
    run = run ? { days: run.days + 1, start: run.start, end: iso } : { days: 1, start: iso, end: iso };
    if (!best || run.days > best.days) best = run;
  }
  return { countedDays, noSpendDays, longestRun: best && best.days >= 2 ? best : null };
}

export type StoryTarget = 'overview' | 'categories' | 'trends';
export type StoryTone = 'coral' | 'sky' | 'lavender' | 'mint' | 'gold';

export interface StoryCard {
  key: string;
  kicker: string;
  big: string;
  detail: string;
  /** A quieter line at the bottom, if any. */
  foot?: string;
  tone: StoryTone;
  /** Which Reports section tapping the card scrolls to. */
  target: StoryTarget;
  /** For the "already spoken for" card: the fixed share, drawn as a moon. */
  moonFraction?: number;
}

export interface StoryInput {
  /** The category that grew most vs the comparison period, with this period's total. */
  mover: { name: string; pctChange: number; totalMinor: number } | null;
  /** "the month before" / "last year" — previousPeriodLabel. */
  comparisonLabel: string;
  /** patternFacts — pass [] for a year view: they describe a month's daily shape. */
  patterns: PatternFact[];
  recurringMinor: number;
  discretionaryMinor: number;
  quiet: QuietDays;
  /** Days in the period with any spending. */
  spendDays: number;
  /** True when the period is the one in progress (this month / this year). */
  isCurrentPeriod: boolean;
  /** "month" or "year" — used in the wording. */
  unit: 'month' | 'year';
}

const PATTERN_TONE: StoryTone[] = ['sky', 'gold'];

function shortDay(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Reports' story cards: the period told in a few big answers, most telling
 * first — what moved, the daily rhythm, how much was already spoken for
 * (the fixed-vs-flexible moon), and the quiet days. Every card is built
 * from something Reports already calculates; nothing here invents a figure.
 * A period in progress with fewer than three spending days gets one "too
 * early" card instead of presenting a two-day pattern as a finding.
 */
export function buildStoryCards(input: StoryInput): StoryCard[] {
  if (input.isCurrentPeriod && input.spendDays < 3) {
    return [
      {
        key: 'early',
        kicker: 'Too early to tell',
        big: 'Check back soon',
        detail: `A few more days of spending and there'll be a story to tell about this ${input.unit}.`,
        tone: 'mint',
        target: 'overview',
      },
    ];
  }

  const cards: StoryCard[] = [];
  if (input.mover) {
    cards.push({
      key: 'mover',
      kicker: 'What moved',
      big: `${input.mover.name} +${formatPctChange(input.mover.pctChange)}`,
      detail: `The biggest jump on ${input.comparisonLabel}. It took ${formatMoney(input.mover.totalMinor)} this ${input.unit}.`,
      tone: 'coral',
      target: 'categories',
    });
  }
  input.patterns
    .filter((p) => p.key !== 'noSpend')
    .slice(0, 2)
    .forEach((p, i) => {
      cards.push({
        key: `pattern-${p.key}`,
        kicker: p.kicker,
        big: p.big,
        detail: p.detail,
        tone: PATTERN_TONE[i % PATTERN_TONE.length],
        target: 'overview',
      });
    });

  const total = input.recurringMinor + input.discretionaryMinor;
  if (total > 0 && input.recurringMinor > 0) {
    const share = input.recurringMinor / total;
    cards.push({
      key: 'fixed',
      kicker: 'Already spoken for',
      big: `${Math.round(share * 100)}%`,
      detail: `${formatMoney(input.recurringMinor)} of it was EMI, rent, insurance and subscriptions — fixed before the ${input.unit} began.`,
      foot: `${formatMoney(input.discretionaryMinor)} was flexible`,
      tone: 'lavender',
      target: 'categories',
      moonFraction: share,
    });
  }

  const q = input.quiet;
  if (q.countedDays > 0) {
    cards.push({
      key: 'quiet',
      kicker: 'Quiet days',
      big:
        q.noSpendDays === 0
          ? 'No quiet days'
          : `${q.noSpendDays} no-spend ${q.noSpendDays === 1 ? 'day' : 'days'}`,
      detail:
        q.noSpendDays === 0
          ? `Something went out on each of the ${q.countedDays} days${input.isCurrentPeriod ? ' so far' : ''}.`
          : `Out of ${q.countedDays}${input.isCurrentPeriod ? ' so far' : ''}.${
              q.longestRun
                ? ` Your longest run was ${q.longestRun.days} days, ${shortDay(q.longestRun.start)} – ${shortDay(q.longestRun.end)}.`
                : ''
            }`,
      tone: 'mint',
      target: 'overview',
    });
  }
  return cards;
}
