import { openPeriod, previewFor, stepPeriod } from './exportChoice';

const months = [
  { month: '2026-09', count: 312, spentMinor: 4826000 },
  { month: '2026-07', count: 40, spentMinor: 100000 },
  { month: '2025-12', count: 9, spentMinor: 5000 },
];

describe('export picker choices', () => {
  it('nets refunds across the selected period before clamping the displayed spending', () => {
    const refunded = [
      { month: '2026-09', count: 1, spentMinor: -5000 },
      { month: '2026-07', count: 1, spentMinor: 10000 },
    ];
    expect(previewFor(refunded, { kind: 'month', year: 2026, month: 9 }).spentMinor).toBe(0);
    expect(previewFor(refunded, { kind: 'year', year: 2026 }).spentMinor).toBe(5000);
    expect(previewFor(refunded, { kind: 'all' }).spentMinor).toBe(5000);
  });
  it('previews a month, a year and everything', () => {
    expect(previewFor(months, { kind: 'month', year: 2026, month: 9 })).toEqual({
      count: 312,
      spentMinor: 4826000,
    });
    expect(previewFor(months, { kind: 'year', year: 2026 })).toEqual({ count: 352, spentMinor: 4926000 });
    expect(previewFor(months, { kind: 'all' }).count).toBe(361);
    expect(previewFor(months, { kind: 'month', year: 2024, month: 1 }).count).toBe(0);
  });
  it('steps only between months with entries, and stops at the ends', () => {
    const sep = { kind: 'month', year: 2026, month: 9 } as const;
    expect(stepPeriod(months, sep, -1)).toEqual({ kind: 'month', year: 2026, month: 7 });
    expect(stepPeriod(months, sep, 1)).toBeNull();
    expect(stepPeriod(months, { kind: 'month', year: 2025, month: 12 }, -1)).toBeNull();
    expect(stepPeriod(months, { kind: 'year', year: 2026 }, -1)).toEqual({ kind: 'year', year: 2025 });
    expect(stepPeriod(months, { kind: 'year', year: 2026 }, 1)).toBeNull();
    expect(stepPeriod(months, { kind: 'all' }, -1)).toBeNull();
  });
  it('opens on the latest month or year with entries', () => {
    expect(openPeriod(months, 'month', '2026-10-23')).toEqual({ kind: 'month', year: 2026, month: 9 });
    expect(openPeriod(months, 'year', '2026-10-23')).toEqual({ kind: 'year', year: 2026 });
    expect(openPeriod([], 'month', '2026-10-23')).toEqual({ kind: 'month', year: 2026, month: 10 });
  });
});
