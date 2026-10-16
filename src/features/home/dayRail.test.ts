import { buildRail, railDayLabel, spentAfterDay, tickLevels } from './dayRail';

const daily = [
  { date: '2026-09-30', totalMinor: 99_900 },
  { date: '2026-10-01', totalMinor: 1_800_000 },
  { date: '2026-10-03', totalMinor: 20_000 },
  { date: '2026-10-04', totalMinor: 40_000 },
  { date: '2026-10-05', totalMinor: 80_000 },
];

describe('buildRail', () => {
  it('lists every day of the month, with spending only up to today and none from other months', () => {
    const rail = buildRail(daily, '2026-10-04');
    expect(rail.days).toHaveLength(31);
    expect(rail.todayDay).toBe(4);
    expect(rail.days[0]).toEqual({ day: 1, date: '2026-10-01', spentMinor: 1_800_000, elapsed: true });
    expect(rail.days[1].spentMinor).toBe(0);
    // Tomorrow's entry is ignored: it has not happened yet.
    expect(rail.days[4]).toEqual({ day: 5, date: '2026-10-05', spentMinor: 0, elapsed: false });
  });

  it('knows a short month', () => {
    expect(buildRail([], '2026-02-10').days).toHaveLength(28);
    expect(buildRail([], '2028-02-10').days).toHaveLength(29);
  });
});

describe('spentAfterDay', () => {
  it('adds up what was spent after a day, through today', () => {
    const rail = buildRail(daily, '2026-10-04');
    expect(spentAfterDay(rail, 1)).toBe(60_000);
    expect(spentAfterDay(rail, 3)).toBe(40_000);
    expect(spentAfterDay(rail, 4)).toBe(0);
  });
});

describe('tickLevels', () => {
  it('shows an ordinary day against the other ordinary days, not against rent', () => {
    const levels = tickLevels(buildRail(daily, '2026-10-04'));
    expect(levels[0]).toBe(1);
    expect(levels[1]).toBe(0);
    expect(levels[2]).toBeGreaterThan(0.3);
    expect(levels[3]).toBeGreaterThan(levels[2]);
  });

  it('is all zero for a month with nothing spent', () => {
    expect(tickLevels(buildRail([], '2026-10-04')).every((l) => l === 0)).toBe(true);
  });
});

describe('railDayLabel', () => {
  it('names a day as day and short month', () => {
    expect(railDayLabel(buildRail([], '2026-10-16'), 7)).toBe('7 Oct');
  });
});
