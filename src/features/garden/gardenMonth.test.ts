import { buildGardenMonth } from './gardenMonth';

const point = (date: string, streakDays: number, tracked = true) => ({ date, streakDays, tracked });

describe('buildGardenMonth', () => {
  it('lays October 2026 out from Monday, marking kept, missed, untracked and future days', () => {
    // 1 Oct 2026 is a Thursday: three blanks before it.
    const m = buildGardenMonth(
      [
        point('2026-10-01', 0, false),
        point('2026-10-02', 1),
        point('2026-10-03', 2),
        point('2026-10-04', 0),
        point('2026-10-05', 1),
      ],
      '2026-10-05'
    );
    expect(m.lead).toBe(3);
    expect(m.days).toHaveLength(31);
    expect(m.days.slice(0, 6).map((d) => d.state)).toEqual([
      'untracked',
      'kept',
      'kept',
      'missed',
      'kept',
      'future',
    ]);
    expect(m.days[4].today).toBe(true);
    expect(m.kept).toBe(3);
    expect(m.counted).toBe(4);
  });

  it('treats a day missing from the series as not counted', () => {
    const m = buildGardenMonth([point('2026-10-02', 1)], '2026-10-02');
    expect(m.days[0].state).toBe('untracked');
    expect(m.counted).toBe(1);
  });
});
