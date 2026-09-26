import {
  heatLevel,
  baselineFromTrend,
  recurringVsDiscretionary,
  categoryDeltas,
  describeSpendingPattern,
  buildStoryCards,
  patternFacts,
  quietDays,
  StoryInput,
  summariseDayTotal,
  buildHeatGrid,
} from './reportsInsights';
import type { CategoryBreakdownItem } from '@/db/reports';
import { parseLocalIsoDate } from '@/lib/date';

const cat = (id: string, name: string, totalMinor: number): CategoryBreakdownItem => ({
  categoryId: id,
  name,
  color: '#000',
  totalMinor,
  hasSubcategories: false,
  isSensitive: false,
});

describe('heatLevel', () => {
  it('is 0 for no spend', () => {
    expect(heatLevel(0, 10000)).toBe(0);
  });
  it('scales with the fraction of the heaviest day', () => {
    expect(heatLevel(10000, 10000)).toBe(4);
    expect(heatLevel(5000, 10000)).toBe(3);
    expect(heatLevel(2000, 10000)).toBe(2);
    expect(heatLevel(500, 10000)).toBe(1);
  });
});

describe('baselineFromTrend', () => {
  it('averages the prior months, excluding the current (last) point', () => {
    const t = [
      { label: 'Apr', totalMinor: 30000 },
      { label: 'May', totalMinor: 40000 },
      { label: 'Jun', totalMinor: 50000 },
      { label: 'Jul', totalMinor: 999999 }, // current — ignored
    ];
    expect(baselineFromTrend(t)).toBe(40000);
  });
  it('is null without at least two prior months', () => {
    expect(
      baselineFromTrend([
        { label: 'Jun', totalMinor: 1 },
        { label: 'Jul', totalMinor: 2 },
      ])
    ).toBeNull();
  });
});

describe('recurringVsDiscretionary', () => {
  it('splits by the fixed-category name set', () => {
    const bd = [cat('a', 'Loan EMI', 2000000), cat('b', 'Rent', 700000), cat('c', 'Food & Dining', 500000)];
    expect(recurringVsDiscretionary(bd)).toEqual({
      recurringMinor: 2700000,
      discretionaryMinor: 500000,
    });
  });
});

describe('categoryDeltas', () => {
  it('is a percentage vs the same category last period, null when it is new', () => {
    const cur = [cat('a', 'Food', 2000), cat('b', 'Fuel', 1000)];
    const prev = [cat('a', 'Food', 1000)];
    const d = categoryDeltas(cur, prev);
    expect(d.get('a')).toBe(100);
    expect(d.get('b')).toBeNull();
  });
});

describe('describeSpendingPattern', () => {
  it('returns nothing for a near-empty month', () => {
    expect(describeSpendingPattern([{ date: '2026-09-03', totalMinor: 500 }], 30)).toEqual([]);
  });
  it('calls out a dominant single day', () => {
    const daily = [
      { date: '2026-09-01', totalMinor: 100000 },
      { date: '2026-09-05', totalMinor: 2000 },
      { date: '2026-09-09', totalMinor: 2000 },
      { date: '2026-09-15', totalMinor: 2000 },
    ];
    const lines = describeSpendingPattern(daily, 30);
    // Built via the same `toLocaleDateString(undefined, ...)` call the
    // production code uses, rather than a hardcoded "1 Sep" literal — the
    // default locale's day/month order differs by environment (e.g. "1 Sept"
    // on a machine defaulting to a day-first locale vs "Sep 1" on one
    // defaulting to en-US), so a hardcoded order passed locally but failed
    // in CI.
    const expectedDate = parseLocalIsoDate('2026-09-01').toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    expect(lines.some((l) => l.includes('Heaviest day') && l.includes(expectedDate))).toBe(true);
  });
});

describe('summariseDayTotal', () => {
  it('shows total spent when the day has only expenses', () => {
    expect(
      summariseDayTotal([
        { type: 'expense', amountMinor: 12000 },
        { type: 'expense', amountMinor: 8000 },
      ])
    ).toEqual({ label: 'Total spent', amountMinor: 20000, sign: '−' });
  });

  it('shows a positive net when income outweighs spend that day', () => {
    expect(
      summariseDayTotal([
        { type: 'income', amountMinor: 8600000 },
        { type: 'expense', amountMinor: 50000 },
      ])
    ).toEqual({ label: 'Net this day', amountMinor: 8550000, sign: '+' });
  });

  it('shows a negative net when spend outweighs income that day', () => {
    expect(
      summariseDayTotal([
        { type: 'income', amountMinor: 10000 },
        { type: 'expense', amountMinor: 25000 },
      ])
    ).toEqual({ label: 'Net this day', amountMinor: 15000, sign: '−' });
  });

  it('ignores transfers between the user’s own accounts', () => {
    expect(
      summariseDayTotal([
        { type: 'transfer', amountMinor: 500000 },
        { type: 'expense', amountMinor: 3000 },
      ])
    ).toEqual({ label: 'Total spent', amountMinor: 3000, sign: '−' });
  });

  it('handles a day with no countable movement', () => {
    expect(summariseDayTotal([{ type: 'transfer', amountMinor: 500000 }])).toEqual({
      label: 'Total spent',
      amountMinor: 0,
      sign: '',
    });
  });
});

describe('patternFacts', () => {
  it('gives each read a card headline alongside the same sentence describeSpendingPattern returns', () => {
    // Four quiet weekdays, then a heavy weekend: weekends run well above weekdays.
    const daily = [
      { date: '2026-09-07', totalMinor: 10000 },
      { date: '2026-09-08', totalMinor: 10000 },
      { date: '2026-09-09', totalMinor: 10000 },
      { date: '2026-09-10', totalMinor: 10000 },
      { date: '2026-09-12', totalMinor: 30000 },
      { date: '2026-09-13', totalMinor: 30000 },
    ];
    const facts = patternFacts(daily, 30);
    const weekend = facts.find((f) => f.key === 'weekends')!;
    expect(weekend.big).toBe('Weekends +200%');
    expect(weekend.sentence).toBe('Weekends run 200% above your weekday average.');
    expect(facts.map((f) => f.sentence)).toEqual(describeSpendingPattern(daily, 30));
  });
});

describe('quietDays', () => {
  const range = { start: '2026-09-01', end: '2026-09-30' };
  const spent = (days: number[]) =>
    days.map((d) => ({ date: `2026-09-${String(d).padStart(2, '0')}`, totalMinor: 100 }));

  it('counts no-spend days only up to today in the period in progress, with the longest run', () => {
    // Spent on 1–10 except 4, 5, 6 (a 3-day run) and 9.
    const q = quietDays(spent([1, 2, 3, 7, 8, 10]), range, '2026-09-10');
    expect(q).toEqual({
      countedDays: 10,
      noSpendDays: 4,
      longestRun: { days: 3, start: '2026-09-04', end: '2026-09-06' },
    });
  });

  it('counts the whole period once it is over, and leaves out a run of just one day', () => {
    const every = Array.from({ length: 30 }, (_, i) => i + 1).filter((d) => d !== 15);
    expect(quietDays(spent(every), range, '2026-10-20')).toEqual({
      countedDays: 30,
      noSpendDays: 1,
      longestRun: null,
    });
  });
});

describe('buildStoryCards', () => {
  const base: StoryInput = {
    mover: null,
    comparisonLabel: 'the month before',
    patterns: [],
    recurringMinor: 0,
    discretionaryMinor: 0,
    quiet: {
      countedDays: 26,
      noSpendDays: 5,
      longestRun: { days: 2, start: '2026-09-11', end: '2026-09-12' },
    },
    spendDays: 21,
    isCurrentPeriod: true,
    unit: 'month',
  };
  const facts = patternFacts(
    [
      { date: '2026-09-07', totalMinor: 10000 },
      { date: '2026-09-08', totalMinor: 10000 },
      { date: '2026-09-09', totalMinor: 10000 },
      { date: '2026-09-10', totalMinor: 10000 },
      { date: '2026-09-12', totalMinor: 30000 },
      { date: '2026-09-13', totalMinor: 30000 },
    ],
    30
  );

  it('tells the period in order: what moved, the rhythm, what was spoken for, quiet days', () => {
    const cards = buildStoryCards({
      ...base,
      mover: { name: 'Food', pctChange: 32.4, totalMinor: 2600000 },
      patterns: facts,
      recurringMinor: 2500000,
      discretionaryMinor: 7500000,
    });
    expect(cards.map((c) => [c.key, c.target])).toEqual([
      ['mover', 'categories'],
      ...facts.slice(0, 2).map((f) => [`pattern-${f.key}`, 'overview']),
      ['fixed', 'categories'],
      ['quiet', 'overview'],
    ]);
    expect(cards[0].big).toBe('Food +32%');
    const fixed = cards.find((c) => c.key === 'fixed')!;
    expect(fixed.big).toBe('25%');
    expect(fixed.moonFraction).toBeCloseTo(0.25, 3);
  });

  it('says how many quiet days there were, and the longest run', () => {
    const quiet = buildStoryCards(base).find((c) => c.key === 'quiet')!;
    expect(quiet.big).toBe('5 no-spend days');
    expect(quiet.detail).toMatch(/^Out of 26 so far\. Your longest run was 2 days, /);
  });

  it('leaves out the fixed card when nothing fixed was paid', () => {
    const cards = buildStoryCards({ ...base, discretionaryMinor: 5000 });
    expect(cards.some((c) => c.key === 'fixed')).toBe(false);
  });

  it('says it is too early rather than guessing, for a period in progress with under 3 spending days', () => {
    expect(buildStoryCards({ ...base, spendDays: 2 }).map((c) => c.key)).toEqual(['early']);
    // A finished period is never "too early".
    expect(buildStoryCards({ ...base, spendDays: 2, isCurrentPeriod: false })[0].key).not.toBe('early');
  });
});

describe('buildHeatGrid', () => {
  it('lays a month out as a calendar: blanks before the 1st, today marked, spend days tappable', () => {
    const onDayPress = jest.fn();
    const grid = buildHeatGrid({
      granularity: 'month',
      start: new Date(2026, 8, 1), // Tue Sep 1 2026
      trend: [],
      daily: [
        { date: '2026-09-05', totalMinor: 90000 },
        { date: '2026-09-06', totalMinor: 10000 },
      ],
      onDayPress,
      todayIso: '2026-09-06',
    });
    expect(grid.columns).toBe(7);
    expect(grid.leadingPad).toBe(2);
    expect(grid.weekdayLabels).toHaveLength(7);
    expect(grid.cells).toHaveLength(30);
    const sat = grid.cells[4];
    expect(sat).toMatchObject({ key: '2026-09-05', label: '5', level: 4, isToday: false });
    expect(grid.cells[5]).toMatchObject({ key: '2026-09-06', level: 1, isToday: true });
    expect(grid.cells[0]).toMatchObject({ level: 0, isToday: false, onPress: undefined });
    sat.onPress!();
    expect(onDayPress).toHaveBeenCalledWith('2026-09-05');
  });

  it('lays a year out as its months, four to a row, with no weekday header', () => {
    const grid = buildHeatGrid({
      granularity: 'year',
      start: new Date(2026, 0, 1),
      trend: [
        { label: 'Jan', totalMinor: 100 },
        { label: 'Feb', totalMinor: 0 },
      ],
      daily: [],
      onDayPress: jest.fn(),
    });
    expect(grid).toEqual({
      cells: [
        { key: 'm-0', label: 'Jan', level: 4 },
        { key: 'm-1', label: 'Feb', level: 0 },
      ],
      leadingPad: 0,
      columns: 4,
    });
  });
});
