import { monthBars, spendBarsStart, weekBars } from './spendBars';

const daily = [
  { date: '2026-10-01', totalMinor: 1000 },
  { date: '2026-10-02', totalMinor: 500 },
  { date: '2026-10-07', totalMinor: 300 },
  { date: '2026-10-08', totalMinor: 135200 },
  { date: '2026-09-30', totalMinor: 700 },
];

describe('Home spending bars', () => {
  it('reaches back far enough for both the week and the month', () => {
    expect(spendBarsStart('2026-10-08')).toBe('2026-10-01');
    expect(spendBarsStart('2026-10-03')).toBe('2026-09-27');
  });

  it('shows the last seven days with today last and dark', () => {
    const bars = weekBars(daily, '2026-10-08');
    expect(bars.map((b) => b.label)).toEqual(['F', 'S', 'S', 'M', 'T', 'W', 'T']);
    expect(bars.map((b) => b.totalMinor)).toEqual([500, 0, 0, 0, 0, 300, 135200]);
    expect(bars.filter((b) => b.current).map((b) => b.key)).toEqual(['2026-10-08']);
  });

  it('adds the month up in weeks from the 1st, up to this week', () => {
    const bars = monthBars(daily, '2026-10-08');
    expect(bars).toEqual([
      { key: 'w1', label: 'W1', totalMinor: 1800, current: false },
      { key: 'w2', label: 'W2', totalMinor: 135200, current: true },
    ]);
  });
});
