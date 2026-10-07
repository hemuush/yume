/** A repeating rule's runs within a window: what the month forecast counts. */
import { advanceDate, runsBetween } from './recurrence';

const rule = (over: Partial<Parameters<typeof runsBetween>[0]>) => ({
  nextRunDate: '2026-10-08',
  frequency: 'weekly' as const,
  intervalCount: 1,
  anchorDay: 8,
  endDate: null,
  ...over,
});

describe('runsBetween', () => {
  it('counts a weekly bill every week left in the month, not once', () => {
    // 8, 15, 22, 29 Oct, all after the 7th.
    expect(runsBetween(rule({}), '2026-10-07', '2026-10-31')).toBe(4);
  });

  it('skips runs on or before today, and stops at the end date', () => {
    expect(runsBetween(rule({}), '2026-10-15', '2026-10-31')).toBe(2);
    expect(runsBetween(rule({ endDate: '2026-10-20' }), '2026-10-07', '2026-10-31')).toBe(2);
  });

  it('counts a daily rule every N days, and a monthly one once', () => {
    expect(runsBetween(rule({ frequency: 'daily', intervalCount: 2 }), '2026-10-07', '2026-10-14')).toBe(4);
    expect(runsBetween(rule({ frequency: 'monthly' }), '2026-10-07', '2026-10-31')).toBe(1);
  });

  it('counts nothing for a rule whose next run is after the window', () => {
    expect(runsBetween(rule({ nextRunDate: '2026-11-02' }), '2026-10-07', '2026-10-31')).toBe(0);
  });
});

describe('advanceDate', () => {
  it('keeps a 31st monthly rule on the month end through a short month', () => {
    expect(advanceDate('2026-02-28', 'monthly', 1, 31)).toBe('2026-03-31');
  });
});
