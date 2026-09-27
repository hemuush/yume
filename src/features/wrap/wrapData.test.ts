/**
 * Which beats a Wrap gets. A beat with nothing true to say is left out:
 * no income means no "kept" beat, no category that grew means no "mover",
 * a week with no history means no "usual". All figures are made up.
 */
import {
  buildMonthWrap,
  buildWeekWrap,
  lastFullWeek,
  weekLabel,
  usualWeekFrom,
  fillDays,
  WRAP_MAX_BARS,
  WrapBeat,
} from './wrapData';
import type { PeriodSummary, PeriodComparison, CategoryBreakdownItem } from '@/db/reports';

function cat(
  id: string,
  totalMinor: number,
  extra: Partial<CategoryBreakdownItem> = {}
): CategoryBreakdownItem {
  return {
    categoryId: id,
    name: id,
    color: '#8FCBFF',
    totalMinor,
    hasSubcategories: false,
    isSensitive: false,
    ...extra,
  };
}

function summary(
  expenseMinor: number,
  incomeMinor: number,
  breakdown: CategoryBreakdownItem[] = []
): PeriodSummary {
  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    savingsContributionMinor: 0,
    categoryBreakdown: breakdown,
    incomeBreakdown: [],
  };
}

function comparison(current: PeriodSummary, previous: PeriodSummary = summary(0, 0)): PeriodComparison {
  return { period: 'month', current, previous, incomeChangePct: null, expenseChangePct: null };
}

const kinds = (beats: WrapBeat[]) => beats.map((b) => b.kind);
const MONTH = { monthStart: '2026-09-01', monthEnd: '2026-09-30' };

describe('buildMonthWrap', () => {
  it('tells the full story when there is income, categories and a mover', () => {
    const wrap = buildMonthWrap({
      ...MONTH,
      comparison: comparison(
        summary(3_840_000, 4_920_000, [cat('rent', 1_500_000), cat('food', 980_000)]),
        summary(3_000_000, 4_900_000, [cat('rent', 1_500_000), cat('food', 742_000)])
      ),
      daily: [
        { date: '2026-09-01', totalMinor: 1_560_000 },
        { date: '2026-09-02', totalMinor: 42_000 },
      ],
    })!;
    expect(kinds(wrap.beats)).toEqual(['hook', 'kept', 'bars', 'days', 'mover', 'final']);
    expect(wrap.label).toBe('September');
    expect(wrap.key).toBe('2026-09');
    const kept = wrap.beats[1] as Extract<WrapBeat, { kind: 'kept' }>;
    expect(kept.keptMinor).toBe(1_080_000);
    expect(Math.round(kept.keptPct)).toBe(22);
    const mover = wrap.beats[4] as Extract<WrapBeat, { kind: 'mover' }>;
    expect(mover.category.categoryId).toBe('food');
    expect(mover.comparedTo).toBe('August');
    expect(wrap.beats[5]).toEqual({ kind: 'final', title: 'That was September.' });
  });

  it('is null when nothing went out', () => {
    expect(buildMonthWrap({ ...MONTH, comparison: comparison(summary(0, 500_000)), daily: [] })).toBeNull();
  });

  it('leaves out the kept beat without income, and the mover when nothing grew', () => {
    const wrap = buildMonthWrap({
      ...MONTH,
      comparison: comparison(
        summary(200_000, 0, [cat('food', 200_000)]),
        summary(300_000, 0, [cat('food', 300_000)])
      ),
      daily: [{ date: '2026-09-10', totalMinor: 200_000 }],
    })!;
    expect(kinds(wrap.beats)).toEqual(['hook', 'bars', 'days', 'final']);
  });

  it('says so when more went out than came in', () => {
    const wrap = buildMonthWrap({ ...MONTH, comparison: comparison(summary(600_000, 500_000)), daily: [] })!;
    const kept = wrap.beats.find((b) => b.kind === 'kept') as Extract<WrapBeat, { kind: 'kept' }>;
    expect(kept.keptMinor).toBe(-100_000);
    expect(kept.keptPct).toBeLessThan(0);
  });

  it('shows at most five categories, biggest first', () => {
    const cats = [10, 70, 30, 60, 20, 50, 40].map((v) => cat(`c${v}`, v * 10_000));
    const wrap = buildMonthWrap({
      ...MONTH,
      comparison: comparison(summary(2_800_000, 0, cats)),
      daily: [],
    })!;
    const bars = wrap.beats.find((b) => b.kind === 'bars') as Extract<WrapBeat, { kind: 'bars' }>;
    expect(bars.items).toHaveLength(WRAP_MAX_BARS);
    expect(bars.items.map((c) => c.categoryId)).toEqual(['c70', 'c60', 'c50', 'c40', 'c30']);
  });

  it('fills every day of the month, finds the heaviest and counts the quiet days', () => {
    const wrap = buildMonthWrap({
      ...MONTH,
      comparison: comparison(summary(300_000, 0)),
      daily: [
        { date: '2026-09-03', totalMinor: 100_000 },
        { date: '2026-09-05', totalMinor: 200_000 },
      ],
    })!;
    const days = wrap.beats.find((b) => b.kind === 'days') as Extract<WrapBeat, { kind: 'days' }>;
    expect(days.days).toHaveLength(30);
    expect(days.heaviest).toEqual({ date: '2026-09-05', totalMinor: 200_000 });
    expect(days.quietDays).toBe(28);
    // 1 September 2026 is a Tuesday.
    expect(days.firstWeekday).toBe(2);
  });

  it('keeps a sensitive category flagged, so its amount can be masked', () => {
    const wrap = buildMonthWrap({
      ...MONTH,
      comparison: comparison(summary(100_000, 0, [cat('invest', 100_000, { isSensitive: true })])),
      daily: [],
    })!;
    const bars = wrap.beats.find((b) => b.kind === 'bars') as Extract<WrapBeat, { kind: 'bars' }>;
    expect(bars.items[0].isSensitive).toBe(true);
  });
});

describe('lastFullWeek', () => {
  it('on a Sunday is the week that ended yesterday', () => {
    expect(lastFullWeek(new Date(2026, 8, 27))).toEqual({ start: '2026-09-20', end: '2026-09-26' });
  });
  it('mid-week is still the last complete Sunday to Saturday', () => {
    expect(lastFullWeek(new Date(2026, 8, 30))).toEqual({ start: '2026-09-20', end: '2026-09-26' });
  });
  it('on a Saturday is the week before, since this one has not finished', () => {
    expect(lastFullWeek(new Date(2026, 9, 3))).toEqual({ start: '2026-09-20', end: '2026-09-26' });
  });
});

describe('weekLabel', () => {
  it('shares the month when it can', () => {
    expect(weekLabel('2026-09-20', '2026-09-26')).toMatch(/^20–26 Sept?$/);
  });
  it('names both months across a month end', () => {
    expect(weekLabel('2026-09-27', '2026-10-03')).toMatch(/^27 Sept? – 3 Oct$/);
  });
});

describe('usualWeekFrom', () => {
  it('averages the earlier weeks that had spending', () => {
    const daily = [
      { date: '2026-09-13', totalMinor: 400_000 }, // week before
      { date: '2026-08-30', totalMinor: 600_000 }, // three weeks before
    ];
    expect(usualWeekFrom('2026-09-20', daily)).toBe(500_000);
  });
  it('is null with no history', () => {
    expect(usualWeekFrom('2026-09-20', [])).toBeNull();
  });
});

describe('buildWeekWrap', () => {
  const WEEK = { start: '2026-09-20', end: '2026-09-26' };

  it('tells the week against the usual week', () => {
    const wrap = buildWeekWrap({
      ...WEEK,
      summary: summary(624_000, 0, [cat('food', 270_000), cat('travel', 100_000)]),
      daily: [
        { date: '2026-09-20', totalMinor: 82_000 },
        { date: '2026-09-23', totalMinor: 190_000 },
      ],
      usualWeekMinor: 709_000,
    });
    expect(kinds(wrap.beats)).toEqual(['hook', 'weekDays', 'usual', 'final']);
    const week = wrap.beats[1] as Extract<WrapBeat, { kind: 'weekDays' }>;
    expect(week.days).toHaveLength(7);
    expect(week.heaviest.date).toBe('2026-09-23');
    expect(week.quietDays).toBe(5);
    const usual = wrap.beats[2] as Extract<WrapBeat, { kind: 'usual' }>;
    expect(Math.round(usual.changePct)).toBe(-12);
    expect(usual.top?.categoryId).toBe('food');
    expect(wrap.beats[3]).toEqual({ kind: 'final', title: 'A lighter week.' });
  });

  it('leaves out the usual beat without history', () => {
    const wrap = buildWeekWrap({ ...WEEK, summary: summary(100_000, 0), daily: [], usualWeekMinor: null });
    expect(kinds(wrap.beats)).toEqual(['hook', 'weekDays', 'final']);
  });

  it('calls a week within 5% of usual steady, and a heavier one bigger', () => {
    const steady = buildWeekWrap({
      ...WEEK,
      summary: summary(102_000, 0),
      daily: [],
      usualWeekMinor: 100_000,
    });
    expect(steady.beats.at(-1)).toEqual({ kind: 'final', title: 'A steady week.' });
    const bigger = buildWeekWrap({
      ...WEEK,
      summary: summary(150_000, 0),
      daily: [],
      usualWeekMinor: 100_000,
    });
    expect(bigger.beats.at(-1)).toEqual({ kind: 'final', title: 'A bigger week.' });
  });

  it('is one quiet frame when nothing went out', () => {
    const wrap = buildWeekWrap({ ...WEEK, summary: summary(0, 0), daily: [], usualWeekMinor: 500_000 });
    expect(wrap.beats).toEqual([{ kind: 'final', title: 'A quiet week. Nothing went out.' }]);
  });
});

describe('fillDays', () => {
  it('puts a zero on days nothing went out', () => {
    expect(fillDays('2026-09-01', '2026-09-03', [{ date: '2026-09-02', totalMinor: 5_000 }])).toEqual([
      { date: '2026-09-01', totalMinor: 0 },
      { date: '2026-09-02', totalMinor: 5_000 },
      { date: '2026-09-03', totalMinor: 0 },
    ]);
  });
});
