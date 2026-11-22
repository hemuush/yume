/**
 * Hard time-logic tests: month-end clamping, leap years, DST zones, periods, cadence, due labels, pace and
 * notification slots. Each zone block sets process.env.TZ and restores it afterwards so nothing leaks.
 */
import {
  addDaysToIsoDate,
  addMonthsToIsoDate,
  daysUntilIsoDate,
  isoDatesInRange,
  isIsoDate,
  monthsBetweenIsoDates,
  nextMonthlyDateAfter,
  parseLocalIsoDate,
  toLocalIsoDate,
  daysLeftInMonth,
} from './date';
import { periodRange, previousPeriodRange, financialYearRange, financialYearOf } from './period';
import { advanceDate, advanceOccurrence, runsBetween } from './recurrence';
import { dueDateLabel, isDueUrgent } from './dueDate';
import { budgetPace, monthPace } from './pace';
import { planNotifications, PLAN_DAYS, type PlanPrefs } from './notificationPlan';
import { clampSlotMinutes } from './notificationTimes';

const ZONES = ['America/New_York', 'Asia/Kolkata', 'Pacific/Auckland', 'Europe/London'];
const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dim = (y: number, m: number) =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

describe.each(ZONES)('time logic in %s', (zone) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it('clamps every day 28-31 across all months for leap and non-leap years', () => {
    for (const year of [2024, 2028, 2100, 2000, 2026]) {
      for (let m = 1; m <= 12; m++) {
        for (let d = 28; d <= 31; d++) {
          if (d > dim(year, m)) continue;
          const start = `${year}-${pad(m)}-${pad(d)}`;
          const ny = m === 12 ? year + 1 : year;
          const nm = m === 12 ? 1 : m + 1;
          const expectDay = Math.min(d, dim(ny, nm));
          expect(addMonthsToIsoDate(start, 1)).toBe(`${ny}-${pad(nm)}-${pad(expectDay)}`);
          expect(addMonthsToIsoDate(`${ny}-${pad(nm)}-${pad(expectDay)}`, 1, d)).toBe(
            addMonthsToIsoDate(`${ny}-${pad(nm)}-01`, 1, d)
          );
        }
      }
    }
  });

  it('Feb 29 handling: leap years and century rules', () => {
    expect(addMonthsToIsoDate('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsToIsoDate('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsToIsoDate('2100-01-31', 1)).toBe('2100-02-28');
    expect(addMonthsToIsoDate('2000-01-30', 1)).toBe('2000-02-29');
    expect(addMonthsToIsoDate('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonthsToIsoDate('2024-02-29', 48)).toBe('2028-02-29');
    expect(addMonthsToIsoDate('2096-02-29', 48)).toBe('2100-02-28');
    expect(addMonthsToIsoDate('2024-02-29', 12, 29)).toBe('2025-02-28');
    expect(addMonthsToIsoDate('2025-02-28', 12, 29)).toBe('2026-02-28');
    expect(addMonthsToIsoDate('2027-02-28', 12, 29)).toBe('2028-02-29');
  });

  it('year boundary and negative months', () => {
    expect(addMonthsToIsoDate('2025-12-31', 1)).toBe('2026-01-31');
    expect(addMonthsToIsoDate('2026-01-31', -1)).toBe('2025-12-31');
    expect(addMonthsToIsoDate('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsToIsoDate('2026-01-15', -13)).toBe('2024-12-15');
    expect(addMonthsToIsoDate('2026-01-15', 0)).toBe('2026-01-15');
    expect(addDaysToIsoDate('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDaysToIsoDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToIsoDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysToIsoDate('2100-02-28', 1)).toBe('2100-03-01');
  });

  it('adding days across DST transitions never skips or repeats a calendar day', () => {
    for (const [from, to] of [
      ['2026-03-01', '2026-04-15'],
      ['2026-10-20', '2026-11-10'],
      ['2026-09-20', '2026-10-10'],
      ['2026-03-25', '2026-04-10'],
    ]) {
      const days = isoDatesInRange(from, to);
      expect(days[0]).toBe(from);
      expect(days[days.length - 1]).toBe(to);
      expect(new Set(days).size).toBe(days.length);
      days.forEach((d, i) => {
        expect(isIsoDate(d)).toBe(true);
        expect(daysUntilIsoDate(d, parseLocalIsoDate(from))).toBe(i);
        if (i > 0) expect(addDaysToIsoDate(days[i - 1], 1)).toBe(d);
      });
    }
  });

  it('daysUntilIsoDate is a whole number of calendar days at any hour, including DST days', () => {
    const dstDays = ['2026-03-08', '2026-11-01', '2026-03-29', '2026-10-25', '2026-04-05', '2026-09-27'];
    for (const iso of dstDays) {
      const [y, m, d] = iso.split('-').map(Number);
      for (const hour of [0, 1, 2, 3, 12, 23]) {
        const ref = new Date(y, m - 1, d, hour, 30);
        expect(daysUntilIsoDate(iso, ref)).toBe(0);
        expect(daysUntilIsoDate(addDaysToIsoDate(iso, 1), ref)).toBe(1);
        expect(daysUntilIsoDate(addDaysToIsoDate(iso, -1), ref)).toBe(-1);
        expect(toLocalIsoDate(ref)).toBe(iso);
      }
    }
  });

  it('toLocalIsoDate uses local fields, not UTC', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
    expect(toLocalIsoDate(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2100-02-29')).toBe(false);
  });

  it('periodRange covers month ends, leap Februaries and offsets over year boundaries', () => {
    const ref = new Date(2024, 2, 31, 23, 59);
    expect(periodRange({ granularity: 'month', offset: 0 }, ref)).toEqual({
      start: '2024-03-01',
      end: '2024-03-31',
    });
    expect(periodRange({ granularity: 'month', offset: -1 }, ref)).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    });
    expect(previousPeriodRange({ granularity: 'month', offset: 0 }, new Date(2100, 2, 31))).toEqual({
      start: '2100-02-01',
      end: '2100-02-28',
    });
    expect(periodRange({ granularity: 'month', offset: -3 }, new Date(2026, 0, 31))).toEqual({
      start: '2025-10-01',
      end: '2025-10-31',
    });
    expect(periodRange({ granularity: 'month', offset: 13 }, new Date(2025, 11, 31))).toEqual({
      start: '2027-01-01',
      end: '2027-01-31',
    });
    expect(periodRange({ granularity: 'year', offset: -1 }, new Date(2026, 0, 1))).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    });
    expect(periodRange({ granularity: 'month', offset: 1 }, new Date(2026, 0, 31))).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('financial years run April to March', () => {
    expect(financialYearOf('2026-03-31')).toBe(2025);
    expect(financialYearOf('2026-04-01')).toBe(2026);
    expect(financialYearRange(2023)).toMatchObject({ start: '2023-04-01', end: '2024-03-31' });
  });

  it('monthly cadence from the 28th-31st keeps the anchor over two years, every start', () => {
    for (const start of [
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2024-01-31',
      '2100-01-31',
    ]) {
      const anchor = Number(start.slice(8));
      let cursor = start;
      for (let i = 1; i <= 24; i++) {
        cursor = advanceDate(cursor, 'monthly', 1, anchor);
        expect(cursor).toBe(addMonthsToIsoDate(start, i, anchor));
        expect(Number(cursor.slice(8))).toBe(
          Math.min(anchor, dim(Number(cursor.slice(0, 4)), Number(cursor.slice(5, 7))))
        );
      }
    }
  });

  it('weekly, biweekly, daily and yearly cadences', () => {
    expect(advanceDate('2026-12-28', 'weekly', 1, 28)).toBe('2027-01-04');
    expect(advanceDate('2026-12-28', 'weekly', 2, 28)).toBe('2027-01-11');
    expect(advanceDate('2026-03-28', 'weekly', 2, 28)).toBe('2026-04-11');
    expect(advanceDate('2026-02-28', 'daily', 3, 28)).toBe('2026-03-03');
    expect(advanceDate('2024-02-28', 'daily', 2, 28)).toBe('2024-03-01');
    expect(advanceDate('2024-02-29', 'yearly', 1, 29)).toBe('2025-02-28');
    expect(advanceDate('2025-02-28', 'yearly', 1, 29)).toBe('2026-02-28');
    expect(advanceDate('2027-02-28', 'yearly', 1, 29)).toBe('2028-02-29');
    expect(advanceDate('2026-01-31', 'monthly', 3, 31)).toBe('2026-04-30');
  });

  it('runsBetween respects after/through/end date and frequency', () => {
    const base = { intervalCount: 1, anchorDay: 31, endDate: null, scheduledDate: null } as const;
    const monthly = { ...base, nextRunDate: '2026-01-31', frequency: 'monthly' as const };
    expect(runsBetween(monthly, '2025-12-31', '2026-06-30')).toBe(6);
    expect(runsBetween(monthly, '2026-01-31', '2026-06-30')).toBe(5);
    expect(runsBetween({ ...monthly, endDate: '2026-03-30' }, '2025-12-31', '2026-12-31')).toBe(2);
    const weekly = { ...base, anchorDay: 1, frequency: 'weekly' as const };
    expect(runsBetween({ ...weekly, nextRunDate: '2026-03-02' }, '2026-02-28', '2026-03-31')).toBe(5);
    expect(
      runsBetween({ ...weekly, intervalCount: 2, nextRunDate: '2026-03-02' }, '2026-02-28', '2026-03-31')
    ).toBe(3);
    expect(runsBetween({ ...weekly, nextRunDate: '2026-05-01' }, '2026-02-28', '2026-03-31')).toBe(0);
    expect(
      runsBetween(
        { ...base, anchorDay: 29, frequency: 'yearly', nextRunDate: '2096-02-29' },
        '2096-01-01',
        '2100-12-31'
      )
    ).toBe(5);
  });

  it('a postponed occurrence never becomes the anchor for later ones', () => {
    const rule = {
      nextRunDate: '2026-02-03',
      scheduledDate: '2026-01-31',
      frequency: 'monthly' as const,
      intervalCount: 1,
      anchorDay: 31,
    };
    expect(advanceOccurrence(rule, '2026-02-03')).toBe('2026-02-28');
    expect(advanceOccurrence(rule, '2026-02-28')).toBe('2026-03-31');
    expect(advanceOccurrence({ ...rule, scheduledDate: null, intervalCount: 0 }, '2026-02-03')).toBe(
      '2026-03-31'
    );
  });

  it('nextMonthlyDateAfter lands on the first same-day date after today', () => {
    expect(nextMonthlyDateAfter('2026-01-31', '2026-02-10')).toBe('2026-02-28');
    expect(nextMonthlyDateAfter('2026-01-31', '2026-02-28')).toBe('2026-03-31');
    expect(nextMonthlyDateAfter('2020-01-31', '2026-02-10')).toBe('2026-02-28');
    expect(nextMonthlyDateAfter('2025-12-15', '2025-12-31')).toBe('2026-01-15');
  });

  it('monthsBetweenIsoDates floors and never goes negative', () => {
    expect(monthsBetweenIsoDates('2026-01-31', '2026-02-28')).toBe(0);
    expect(monthsBetweenIsoDates('2025-09-05', '2026-09-04')).toBe(11);
    expect(monthsBetweenIsoDates('2025-09-05', '2026-09-05')).toBe(12);
    expect(monthsBetweenIsoDates('2026-05-01', '2025-01-01')).toBe(0);
  });

  it('daysLeftInMonth handles leap February and month ends', () => {
    expect(daysLeftInMonth(new Date(2024, 1, 28, 23, 0))).toBe(1);
    expect(daysLeftInMonth(new Date(2024, 1, 29, 0, 0))).toBe(0);
    expect(daysLeftInMonth(new Date(2100, 1, 28))).toBe(0);
    expect(daysLeftInMonth(new Date(2026, 0, 1))).toBe(30);
  });

  it('dueDateLabel and isDueUrgent follow the local calendar today', () => {
    jest.useFakeTimers();
    try {
      for (const now of [
        new Date(2026, 2, 8, 23, 59),
        new Date(2026, 10, 1, 0, 1),
        new Date(2026, 2, 29, 12, 0),
      ]) {
        jest.setSystemTime(now);
        const today = toLocalIsoDate(now);
        expect(dueDateLabel(today)).toBe('Due today');
        expect(dueDateLabel(addDaysToIsoDate(today, 1))).toBe('Due tomorrow');
        expect(dueDateLabel(addDaysToIsoDate(today, 2))).toBe('Due in 2 days');
        expect(dueDateLabel(addDaysToIsoDate(today, 90))).toBe('Due in 90 days');
        expect(dueDateLabel(addDaysToIsoDate(today, 91))).toMatch(/^Due on /);
        expect(dueDateLabel(addDaysToIsoDate(today, -1))).toBe('Overdue by 1 day');
        expect(dueDateLabel(addDaysToIsoDate(today, -5))).toBe('Overdue by 5 days');
        expect(isDueUrgent(today)).toBe(true);
        expect(isDueUrgent(addDaysToIsoDate(today, 1))).toBe(false);
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('pace: no forecast before day 5, correct on month lengths, leap February', () => {
    const input = { spentMinor: 0, everydaySpentMinor: 0, dueRestOfMonthMinor: 0 };
    expect(monthPace({ ...input, today: '2026-03-04' })).toBeNull();
    expect(monthPace({ ...input, everydaySpentMinor: 500, today: '2026-03-05' })).toBe(
      Math.round((500 / 5) * 26)
    );
    expect(monthPace({ ...input, everydaySpentMinor: 2900, today: '2024-02-29' })).toBe(0);
    expect(
      monthPace({ spentMinor: 100, everydaySpentMinor: 1000, dueRestOfMonthMinor: 50, today: '2024-02-10' })
    ).toBe(100 + 100 * 19 + 50);
    expect(budgetPace(0.5, '2024-02-29').expectedFraction).toBe(1);
    expect(budgetPace(0.5, '2100-02-14').expectedFraction).toBe(0.5);
    expect(budgetPace(1.0001, '2026-03-15').state).toBe('over');
    expect(budgetPace(Number.NaN, '2026-03-15').state).toBe('over');
    expect(budgetPace(0.7, '2026-03-15').state).toBe('ahead');
    expect(budgetPace(0.58, '2026-03-15').state).toBe('onTrack');
  });
});

describe('notification slot planning', () => {
  const prefs: PlanPrefs = {
    recurringAlerts: true,
    refundAlerts: true,
    morningEnabled: true,
    morningHour: 9,
    morningMinute: 0,
    eveningEnabled: true,
    eveningHour: 20,
    eveningMinute: 0,
    overspendAlerts: true,
    billAlerts: true,
    weeklySummary: true,
  };
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it('clamps times to the 30-minute grid inside each slot range', () => {
    expect(clampSlotMinutes('morning', 0)).toBe(300);
    expect(clampSlotMinutes('morning', 24 * 60)).toBe(690);
    expect(clampSlotMinutes('evening', 12 * 60)).toBe(960);
    expect(clampSlotMinutes('evening', 20 * 60 + 14)).toBe(20 * 60);
    expect(clampSlotMinutes('evening', 20 * 60 + 15)).toBe(20 * 60 + 30);
  });

  it.each(ZONES)('skips slots already past, never duplicates ids, stays in order (%s)', (zone) => {
    process.env.TZ = zone;
    const starts = [
      new Date(2026, 2, 7, 10, 0),
      new Date(2026, 9, 24, 21, 0),
      new Date(2026, 9, 31, 8, 0),
      new Date(2026, 2, 28, 9, 0),
    ];
    for (const start of starts) {
      const { notifications } = planNotifications({
        prefs,
        loans: [],
        alerts: [],
        loggedToday: false,
        now: start,
      });
      const ids = notifications.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const n of notifications) {
        expect(n.at.getTime()).toBeGreaterThan(start.getTime());
        expect(n.id.startsWith('yume-')).toBe(true);
        expect([9 * 60, 20 * 60]).toContain(n.at.getHours() * 60 + n.at.getMinutes());
      }
      const times = notifications.map((n) => n.at.getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
      const lastDay = addDaysToIsoDate(toLocalIsoDate(start), PLAN_DAYS - 1);
      expect(toLocalIsoDate(notifications[notifications.length - 1].at) <= lastDay).toBe(true);
    }
  });

  it('after the evening time only later days are planned; before it, today evening is included', () => {
    process.env.TZ = 'America/New_York';
    const base = { prefs, loans: [], alerts: [] };
    const late = planNotifications({ ...base, loggedToday: false, now: new Date(2026, 5, 10, 21, 0) });
    expect(late.notifications.every((n) => toLocalIsoDate(n.at) > '2026-06-10')).toBe(true);
    const early = planNotifications({ ...base, loggedToday: false, now: new Date(2026, 5, 10, 7, 0) });
    expect(early.notifications[0].id).toBe('yume-2026-06-10-evening');
    const logged = planNotifications({ ...base, loggedToday: true, now: new Date(2026, 5, 10, 7, 0) });
    expect(logged.notifications.some((n) => n.id === 'yume-2026-06-10-evening')).toBe(false);
  });

  it('an EMI due today after both slots passed is reminded as overdue the next day, for 7 days', () => {
    const { notifications } = planNotifications({
      prefs,
      loans: [{ id: 'L1', counterparty: 'Bank', dueDate: '2026-06-10', emiMinor: 100000 }],
      alerts: [],
      loggedToday: true,
      now: new Date(2026, 5, 10, 21, 0),
    });
    expect(notifications.some((n) => n.id.startsWith('yume-2026-06-10'))).toBe(false);
    expect(notifications.find((n) => n.id === 'yume-2026-06-11-morning')?.route).toBe('/loans');
    const days = notifications.filter((n) => n.route === '/loans').map((n) => toLocalIsoDate(n.at));
    expect(days[days.length - 1]).toBe('2026-06-17');
  });

  it('same-day EMIs on a clamped month-end merge into one notification', () => {
    const { notifications } = planNotifications({
      prefs,
      loans: [
        { id: 'A', counterparty: 'A', dueDate: '2026-02-28', emiMinor: 100 },
        { id: 'B', counterparty: 'B', dueDate: '2026-02-28', emiMinor: 200 },
      ],
      alerts: [],
      loggedToday: true,
      now: new Date(2026, 1, 20, 6, 0),
    });
    const hits = notifications.filter((n) => n.id === 'yume-2026-02-28-morning');
    expect(hits).toHaveLength(1);
    expect(hits[0].reminderKeys).toEqual(['2026-02-28:emi:A', '2026-02-28:emi:B']);
  });

  it('bill alerts go out the day before and are not re-planned once they elapsed', () => {
    const attention = [{ kind: 'bill' as const, id: 'r1', label: 'Rent', date: '2026-03-01' }];
    const base = { prefs, loans: [], alerts: [], attention, loggedToday: true };
    const first = planNotifications({ ...base, now: new Date(2026, 1, 20, 6, 0) });
    expect(first.notifications.find((n) => n.reminderKeys.includes('2026-02-28:bill:r1'))?.id).toBe(
      'yume-2026-02-28-morning'
    );
    const again = planNotifications({
      ...base,
      now: new Date(2026, 1, 28, 12, 0),
      previouslyScheduled: [
        { key: '2026-02-28:bill:r1', at: new Date(2026, 1, 28, 9, 0).toISOString() },
      ] as never,
    });
    expect(again.notifications.some((n) => n.reminderKeys.includes('2026-02-28:bill:r1'))).toBe(false);
  });

  it('weekly summary only on Mondays, once per Monday', () => {
    const { notifications } = planNotifications({
      prefs,
      loans: [],
      alerts: [],
      loggedToday: true,
      now: new Date(2026, 5, 10, 6, 0),
    });
    const wraps = notifications.filter((n) => n.route === '/wrap?period=week');
    expect(wraps.length).toBe(2);
    wraps.forEach((n) => expect(n.at.getDay()).toBe(1));
  });

  it('an overspend alert queued after both slots waits for the next slot and expires after three days', () => {
    const alert = {
      id: 'a1',
      queuedAt: new Date(2026, 5, 10, 21, 30).toISOString(),
      title: 't',
      body: 'b',
      extra: 'e',
      route: '/budgets' as const,
    };
    const base = { prefs, loans: [], alerts: [alert], loggedToday: true };
    const planned = planNotifications({ ...base, now: new Date(2026, 5, 10, 22, 0) });
    expect(planned.waitingAlerts[0].scheduledNotificationId).toBe('yume-2026-06-11-morning');
    expect(
      planned.notifications.some((n) => n.id === 'yume-2026-06-11-morning' && n.route === '/budgets')
    ).toBe(true);
    expect(planNotifications({ ...base, now: new Date(2026, 5, 14, 6, 0) }).waitingAlerts).toHaveLength(0);
    const off = planNotifications({
      ...base,
      prefs: { ...prefs, morningEnabled: false, eveningEnabled: false },
      now: new Date(2026, 5, 10, 22, 0),
    });
    expect(off.notifications).toHaveLength(0);
    expect(off.waitingAlerts).toHaveLength(1);
  });
});
