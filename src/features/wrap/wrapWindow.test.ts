/**
 * When Home's Wrap button offers a Wrap: last week's on a Monday, last month's on the 1st-7th, both on a
 * Monday in the first week, neither when the period had no spending. Made-up figures.
 */
const mockSpent: Record<string, number> = {};
const mockSeen = { current: [] as string[] };
jest.mock('@/db/reports', () => ({
  getPeriodSummary: jest.fn(async ({ start }: { start: string }) => ({
    expenseMinor: mockSpent[start] ?? 0,
  })),
}));
jest.mock('@/db/settings', () => ({
  getSeenWraps: jest.fn(async () => mockSeen.current),
  getCachedHideSensitiveAmounts: () => false,
}));

import { getPeriodSummary } from '@/db/reports';
import { wrapWindow, loadReadyWraps } from './wrapWindow';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0);

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockSpent)) delete mockSpent[k];
  mockSeen.current = [];
});

describe('wrap window', () => {
  it('offers last week on a Monday, for the Sunday–Saturday just ended', () => {
    expect(wrapWindow(day(2026, 10, 12))).toEqual({
      month: null,
      week: expect.objectContaining({ key: '2026-10-04', start: '2026-10-04', end: '2026-10-10' }),
    });
  });

  it('offers last month on the 1st to the 7th', () => {
    expect(wrapWindow(day(2026, 10, 1)).month).toEqual(
      expect.objectContaining({ key: '2026-09', label: 'September', start: '2026-09-01', end: '2026-09-30' })
    );
    expect(wrapWindow(day(2026, 10, 7)).month?.key).toBe('2026-09');
    expect(wrapWindow(day(2026, 10, 8)).month).toBeNull();
  });

  it('offers both on a Monday in the first week, and neither on an ordinary day', () => {
    const both = wrapWindow(day(2026, 10, 5));
    expect(both.month?.key).toBe('2026-09');
    expect(both.week?.key).toBe('2026-09-27');
    // Today: a Sunday late in the month.
    expect(wrapWindow(day(2026, 9, 27))).toEqual({ month: null, week: null });
  });

  it('crosses into a new year', () => {
    expect(wrapWindow(day(2027, 1, 4))).toEqual({
      month: expect.objectContaining({ key: '2026-12', label: 'December' }),
      week: expect.objectContaining({ key: '2026-12-27', end: '2027-01-02' }),
    });
  });
});

describe('ready wraps', () => {
  it('lists what had spending, month first, and which were already played', async () => {
    mockSpent['2026-09-01'] = 3_842_000;
    mockSpent['2026-09-27'] = 615_000;
    mockSeen.current = ['2026-09'];
    expect(await loadReadyWraps(day(2026, 10, 5))).toEqual([
      { period: 'month', key: '2026-09', label: 'September', spentMinor: 3_842_000, seen: true },
      { period: 'week', key: '2026-09-27', label: expect.any(String), spentMinor: 615_000, seen: false },
    ]);
  });

  it('leaves out a period with no spending', async () => {
    mockSpent['2026-09-27'] = 615_000;
    const ready = await loadReadyWraps(day(2026, 10, 5));
    expect(ready.map((w) => w.period)).toEqual(['week']);
  });

  it('asks nothing of the database on a day with no Wrap', async () => {
    expect(await loadReadyWraps(day(2026, 10, 14))).toEqual([]);
    expect(getPeriodSummary).not.toHaveBeenCalled();
  });
});
