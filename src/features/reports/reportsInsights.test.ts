import {
  heatLevel,
  baselineFromTrend,
  recurringVsDiscretionary,
  categoryDeltas,
  buildStoryCards,
  patternFacts,
  quietDays,
  StoryInput,
  summariseDayTotal,
  buildHeatGrid,
  vsUsual,
  daySpendFacts,
  weekdayRhythm,
  weekdayReadLine,
  WEEKDAY_MIN_DAYS,
  keptSummary,
  cashFlowReadLine,
  categoriesAgainstUsual,
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

// September 2026, over by the time "today" comes.
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' };
// One Monday-to-Sunday week.
const WEEK = { start: '2026-09-07', end: '2026-09-13' };

describe('patternFacts: the heaviest day', () => {
  it('returns nothing for a near-empty month', () => {
    expect(patternFacts([{ date: '2026-09-03', totalMinor: 500 }], 30, SEPTEMBER, '2026-10-20')).toEqual([]);
  });
  it('calls out a dominant single day', () => {
    const daily = [
      { date: '2026-09-01', totalMinor: 100000 },
      { date: '2026-09-05', totalMinor: 2000 },
      { date: '2026-09-09', totalMinor: 2000 },
      { date: '2026-09-15', totalMinor: 2000 },
    ];
    // Built with the same toLocaleDateString call as the code: day/month order differs by locale.
    const expectedDate = parseLocalIsoDate('2026-09-01').toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    const heaviest = patternFacts(daily, 30, SEPTEMBER, '2026-10-20').find((f) => f.key === 'heaviest')!;
    expect(heaviest.kicker).toBe('Heaviest day');
    expect(heaviest.big).toBe(expectedDate);
    expect(heaviest.detail).toMatch(/94% of the month in one day/);
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

describe('patternFacts on a custom range or a month in progress', () => {
  // Seven even days spread over the first fortnight (no heavy day, not front-loaded, weekends like
  // weekdays), so only the fallback reads apply.
  const even = ['03', '05', '09', '10', '11', '13', '14'].map((d) => ({
    date: `2026-09-${d}`,
    totalMinor: 10000,
  }));

  it('counts no-spend days only up to today in a month still going, not the days to come', () => {
    const facts = patternFacts(even, 30, { start: '2026-09-01', end: '2026-09-30' }, '2026-09-14');
    // 14 days so far, 7 with spending; the 16 days still to come aren't counted.
    expect(facts.find((f) => f.key === 'noSpend')?.big).toBe('7 no-spend days');
  });

  it('says "the period", and looks at its own first eight days, for a range that is not a whole month', () => {
    const range = { start: '2026-09-20', end: '2026-10-10' };
    const daily = [
      { date: '2026-09-20', totalMinor: 90000 },
      { date: '2026-09-22', totalMinor: 10000 },
      { date: '2026-10-05', totalMinor: 5000 },
    ];
    const facts = patternFacts(daily, 21, range, '2026-10-20');
    expect(facts.find((f) => f.key === 'heaviest')?.detail).toMatch(/of the period in one day/);
    expect(facts.find((f) => f.key === 'frontLoaded')?.detail).toBe(
      'Most of the period went out in its first eight days.'
    );
  });
});

describe('patternFacts', () => {
  it('gives each read a card label, headline and detail', () => {
    // Four quiet weekdays, then a heavy weekend: weekends run well above weekdays.
    const daily = [
      { date: '2026-09-07', totalMinor: 10000 },
      { date: '2026-09-08', totalMinor: 10000 },
      { date: '2026-09-09', totalMinor: 10000 },
      { date: '2026-09-10', totalMinor: 10000 },
      { date: '2026-09-12', totalMinor: 30000 },
      { date: '2026-09-13', totalMinor: 30000 },
    ];
    const facts = patternFacts(daily, 7, WEEK, '2026-10-20');
    const weekend = facts.find((f) => f.key === 'weekends')!;
    // Weekdays average 8,000 over five days (Friday spent nothing); weekends 30,000.
    expect(weekend.big).toBe('Weekends +275%');
    expect(weekend.kicker).toBeTruthy();
    expect(weekend.detail).toBeTruthy();
  });

  it('counts spend-free days in the weekend read, the same basis as the weekday rhythm', () => {
    // Two weeks (Mon–Sun), spent every weekday and each Saturday, never on a Sunday. Over spend days alone
    // weekends would match weekdays (10,000 each); counting the quiet Sundays they run well below.
    const range = { start: '2026-09-07', end: '2026-09-20' };
    const days = [7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19];
    const daily = days.map((d) => ({ date: `2026-09-${String(d).padStart(2, '0')}`, totalMinor: 10000 }));
    const weekend = patternFacts(daily, 14, range, '2026-10-20').find((f) => f.key === 'weekends')!;
    expect(weekend.big).toBe('Weekends −50%');
    // The weekday rhythm agrees: Saturdays 10,000, Sundays nothing — weekends average 5,000 a day.
    const rhythm = weekdayRhythm(daily, range, '2026-10-20')!;
    expect((rhythm.avgMinor[6] + rhythm.avgMinor[0]) / 2).toBe(5000);
  });

  it('leaves out days after today, as the weekday rhythm does', () => {
    // Today is Friday the 11th: Saturday and Sunday are not here yet, so there is no weekend to compare.
    const daily = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'].map((date) => ({
      date,
      totalMinor: 10000,
    }));
    expect(patternFacts(daily, 7, WEEK, '2026-09-11').some((f) => f.key === 'weekends')).toBe(false);
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
    7,
    WEEK,
    '2026-10-20'
  );

  it('tells the period in order: what moved, the rhythm, what was spoken for, quiet days', () => {
    const cards = buildStoryCards({
      ...base,
      mover: { categoryId: 'food', name: 'Food', pctChange: 32.4, totalMinor: 2600000 },
      patterns: facts,
      recurringMinor: 2500000,
      discretionaryMinor: 7500000,
    });
    expect(cards.map((c) => c.key)).toEqual([
      'mover',
      ...facts.slice(0, 2).map((f) => `pattern-${f.key}`),
      'fixed',
      'quiet',
    ]);
    // The cards that point somewhere act on the page; the rest are plain.
    expect(cards[0].action).toEqual({ type: 'category', id: 'food' });
    expect(cards.find((c) => c.key === 'fixed')!.action).toEqual({ type: 'categories' });
    expect(cards.find((c) => c.key === 'quiet')!.action).toBeUndefined();
    const heaviest = cards.find((c) => c.key === 'pattern-heaviest');
    if (heaviest) expect(heaviest.action).toEqual({ type: 'day', iso: '2026-09-12' });
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
    // It is a slim note, not a full-height card.
    expect(buildStoryCards({ ...base, spendDays: 2 })[0].compact).toBe(true);
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

  it('marks the days after today as future, so they can be faded', () => {
    const grid = buildHeatGrid({
      granularity: 'month',
      start: new Date(2026, 8, 1),
      trend: [],
      daily: [],
      onDayPress: jest.fn(),
      todayIso: '2026-09-06',
    });
    expect(grid.cells[5].isFuture).toBe(false);
    expect(grid.cells[6].isFuture).toBe(true);
    expect(grid.cells[0].isFuture).toBe(false);
  });

  it('marks the picked day as selected', () => {
    const grid = buildHeatGrid({
      granularity: 'month',
      start: new Date(2026, 8, 1),
      trend: [],
      daily: [{ date: '2026-09-05', totalMinor: 90000 }],
      onDayPress: jest.fn(),
      todayIso: '2026-09-06',
      selectedIso: '2026-09-05',
    });
    expect(grid.cells.filter((c) => c.isSelected).map((c) => c.key)).toEqual(['2026-09-05']);
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

describe('vsUsual', () => {
  // A usual month of ₹33,683.00 in a 31-day month.
  const usual = 33_683_00;
  const base = {
    baselineMinor: usual,
    granularity: 'month' as const,
    inProgress: false,
    todayIso: '2026-10-02',
  };

  it('says nothing before day 5 of the month in progress', () => {
    expect(vsUsual({ ...base, spentMinor: 13_784_00, inProgress: true, todayIso: '2026-10-02' })).toBeNull();
    expect(vsUsual({ ...base, spentMinor: 13_784_00, inProgress: true, todayIso: '2026-10-04' })).toBeNull();
    expect(
      vsUsual({ ...base, spentMinor: 13_784_00, inProgress: true, todayIso: '2026-10-05' })
    ).not.toBeNull();
  });

  it('holds the month in progress against the usual month so far', () => {
    const r = vsUsual({ ...base, spentMinor: 14_600_00, inProgress: true, todayIso: '2026-10-12' })!;
    expect(r.soFar).toBe(true);
    // 33,683 × 12 ÷ 31 = 13,038.57 → 14,600 is about 12% above.
    expect(Math.round(r.pct)).toBe(12);
  });

  it('compares a finished month with the whole usual month', () => {
    const r = vsUsual({ ...base, spentMinor: 13_784_00 })!;
    expect(r.soFar).toBe(false);
    expect(Math.round(r.pct)).toBe(-59);
  });

  it('has no usual month for a year or a custom range, or without a baseline', () => {
    expect(vsUsual({ ...base, spentMinor: 1, granularity: 'year' })).toBeNull();
    expect(vsUsual({ ...base, spentMinor: 1, granularity: 'custom' })).toBeNull();
    expect(vsUsual({ ...base, spentMinor: 1, baselineMinor: null })).toBeNull();
  });
});

describe('daySpendFacts', () => {
  const sep = { start: '2026-09-01', end: '2026-09-30' };

  it('counts the days so far for the period in progress', () => {
    const f = daySpendFacts(
      [
        { date: '2026-09-02', totalMinor: 30000 },
        { date: '2026-09-04', totalMinor: 10000 },
      ],
      sep,
      '2026-09-10',
      40000
    );
    expect(f).toEqual({ spendDays: 2, countedDays: 10, laterMinor: 0, perDayMinor: 4000 });
  });

  it('keeps entries dated after today out of the spend days and the per-day figure', () => {
    const f = daySpendFacts(
      [
        { date: '2026-09-02', totalMinor: 30000 },
        { date: '2026-09-20', totalMinor: 70000 },
      ],
      sep,
      '2026-09-10',
      100000
    );
    expect(f.spendDays).toBe(1);
    expect(f.laterMinor).toBe(70000);
    expect(f.perDayMinor).toBe(3000);
  });

  it('counts the whole range for a finished period', () => {
    const f = daySpendFacts([{ date: '2026-09-02', totalMinor: 30000 }], sep, '2026-10-03', 30000);
    expect(f).toMatchObject({ spendDays: 1, countedDays: 30, laterMinor: 0, perDayMinor: 1000 });
  });

  it('is all zeros for a range that has not started', () => {
    expect(daySpendFacts([], sep, '2026-08-20', 0)).toEqual({
      spendDays: 0,
      countedDays: 0,
      laterMinor: 0,
      perDayMinor: 0,
    });
  });
});

describe('weekdayRhythm', () => {
  // October 2026 starts on a Thursday; the 20th is a Tuesday.
  const range = { start: '2026-10-01', end: '2026-10-31' };
  const day = (date: string, totalMinor: number) => ({ date, totalMinor });

  it('is null before there are enough days to call a pattern', () => {
    expect(weekdayRhythm([day('2026-10-03', 5000)], range, '2026-10-10')).toBeNull();
    expect(WEEKDAY_MIN_DAYS).toBe(14);
  });

  it('is null when nothing was spent', () => {
    expect(weekdayRhythm([], range, '2026-10-20')).toBeNull();
  });

  it('averages each weekday over every such day so far, spend-free days included', () => {
    // Saturdays so far: 3rd, 10th, 17th (three), two with spending; Wednesday is seen only twice.
    const r = weekdayRhythm([day('2026-10-03', 6000), day('2026-10-17', 3000)], range, '2026-10-20')!;
    expect(r.countedDays).toBe(20);
    expect(r.counts).toEqual([3, 3, 3, 2, 3, 3, 3]);
    expect(r.avgMinor[6]).toBe(3000);
    expect(r.peak).toBe(6);
    expect(r.usualMinor).toBe(450);
  });

  it('leaves spending dated after today out of the days', () => {
    const r = weekdayRhythm([day('2026-10-03', 6000), day('2026-10-25', 90000)], range, '2026-10-20')!;
    expect(r.usualMinor).toBe(300);
    expect(r.avgMinor.every((a) => a <= 2000)).toBe(true);
  });

  it('counts a whole past period in full', () => {
    const r = weekdayRhythm(
      [day('2026-09-02', 3000)],
      { start: '2026-09-01', end: '2026-09-30' },
      '2026-10-20'
    )!;
    expect(r.countedDays).toBe(30);
  });
});

describe('weekdayReadLine', () => {
  const rhythm = {
    avgMinor: [0, 0, 0, 20000, 0, 0, 100000],
    counts: [3, 3, 3, 1, 3, 3, 3],
    usualMinor: 50000,
    peak: 6,
    countedDays: 20,
  };

  it('calls the busiest weekday out against the usual day', () => {
    expect(weekdayReadLine(rhythm, 6)).toMatch(/^Saturdays run highest: .* 100% above your /);
  });

  it('reads another weekday below the usual and says how many it is over', () => {
    expect(weekdayReadLine(rhythm, 3)).toMatch(/^Wednesday: .* a day over 1 Wednesday · 60% below your /);
  });

  it('says "about" when it is within a few percent', () => {
    const r = { ...rhythm, avgMinor: [49000, 0, 0, 0, 0, 0, 100000] };
    expect(weekdayReadLine(r, 0)).toMatch(/· about your /);
  });

  it('never divides by a zero usual day', () => {
    const r = { ...rhythm, avgMinor: [0, 0, 0, 0, 0, 0, 0], usualMinor: 0, peak: 0 };
    const line = weekdayReadLine(r, 3);
    expect(line).not.toMatch(/NaN|Infinity/);
    expect(line).toMatch(/· about your /);
  });
});

describe('keptSummary', () => {
  const p = (label: string, incomeMinor: number, expenseMinor: number) => ({
    label,
    incomeMinor,
    expenseMinor,
  });
  const months = [
    p('Jul', 8000000, 5000000),
    p('Aug', 8000000, 9000000),
    p('Sep', 8000000, 4000000),
    p('Oct', 8000000, 1000000),
  ];

  it('averages the finished months, finds the best one and counts those that kept something', () => {
    const s = keptSummary(months, true)!;
    expect(s.months).toBe(3);
    expect(s.avgKeptMinor).toBe(2000000);
    expect(s.best).toEqual({ label: 'Sep', keptMinor: 4000000, ratePct: 50 });
    expect(s.inBlack).toBe(2);
    expect(s.usualRatePct).toBe(25);
  });

  it('counts a last month that is finished', () => {
    expect(keptSummary(months, false)!.months).toBe(4);
  });

  it('is null with fewer than two finished months', () => {
    expect(keptSummary(months.slice(2), true)).toBeNull();
  });

  it('leaves out months with nothing recorded', () => {
    expect(keptSummary([p('May', 0, 0), p('Jun', 0, 0), ...months.slice(0, 2)], false)!.months).toBe(2);
  });
});

describe('cashFlowReadLine', () => {
  const p = (incomeMinor: number, expenseMinor: number) => ({ label: 'Oct', incomeMinor, expenseMinor });

  it('reads a finished month that kept something', () => {
    expect(cashFlowReadLine(p(8000000, 5000000), false, 30)).toMatch(
      /^Oct: .* in, .* out\. Kept .*, 38% of it\.$/
    );
  });

  it('reads a month still going against the usual rate', () => {
    expect(cashFlowReadLine(p(8000000, 5600000), true, 36)).toMatch(
      /^Oct so far: .* in, .* out\. You have kept 30% of it, your usual is 36%\.$/
    );
  });

  it('says when more went out than came in', () => {
    expect(cashFlowReadLine(p(8000000, 9000000), false, null)).toMatch(/more went out than came in\.$/);
  });

  it('says when no income was recorded', () => {
    expect(cashFlowReadLine(p(0, 500000), false, null)).toMatch(/^Oct: no income recorded, .* out\.$/);
  });
});

describe('categoriesAgainstUsual', () => {
  const t = (categoryId: string, name: string, totalsMinor: number[]) => ({
    categoryId,
    name,
    color: '#8FE8C8',
    totalsMinor,
  });

  it('compares the latest month with the earlier ones, furthest over first', () => {
    const rows = categoriesAgainstUsual([
      t('a', 'Dining', [100, 100, 100, 150]),
      t('b', 'Food', [400, 400, 400, 800]),
      t('c', 'Travel', [300, 300, 300, 0]),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Food', 'Dining', 'Travel']);
    expect(rows[0]).toMatchObject({ usualMinor: 400, nowMinor: 800, pct: 200 });
    expect(rows[2].pct).toBe(0);
  });

  it('counts a category from its first month with spending', () => {
    const rows = categoriesAgainstUsual([t('a', 'Gym', [0, 0, 200, 200, 400])]);
    expect(rows[0].usualMinor).toBe(200);
  });

  it('leaves out a category with fewer than two earlier months', () => {
    expect(categoriesAgainstUsual([t('a', 'New', [0, 0, 0, 200, 400])])).toEqual([]);
    expect(categoriesAgainstUsual([t('a', 'Quiet', [0, 0, 0, 0, 400])])).toEqual([]);
  });
});
