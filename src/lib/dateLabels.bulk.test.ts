/**
 * The date labels are cached (a formatter per label, and the labels of dates already shown). This pins that they read
 * exactly as `toLocaleDateString(undefined, options)` did, over four years of days in this phone locale, and that a
 * formatter is made once however many dates are labelled.
 */
import { addDaysToIsoDate, parseLocalIsoDate } from './date';
import {
  dayMonth,
  dayMonthYear,
  longMonth,
  longMonthYear,
  longWeekday,
  shortMonth,
  shortMonthYear,
  shortWeekday,
  weekdayDayMonth,
  weekdayDayMonthYear,
} from './dateLabels';

const LABELS: [string, (iso: string) => string, Intl.DateTimeFormatOptions][] = [
  ['dayMonth', dayMonth, { day: 'numeric', month: 'short' }],
  ['dayMonthYear', dayMonthYear, { day: 'numeric', month: 'short', year: 'numeric' }],
  ['weekdayDayMonth', weekdayDayMonth, { weekday: 'short', day: 'numeric', month: 'short' }],
  [
    'weekdayDayMonthYear',
    weekdayDayMonthYear,
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
  ],
  ['shortWeekday', shortWeekday, { weekday: 'short' }],
  ['longWeekday', longWeekday, { weekday: 'long' }],
  ['shortMonth', shortMonth, { month: 'short' }],
  ['longMonth', longMonth, { month: 'long' }],
  ['shortMonthYear', shortMonthYear, { month: 'short', year: 'numeric' }],
  ['longMonthYear', longMonthYear, { month: 'long', year: 'numeric' }],
];

describe('cached date labels', () => {
  it('read exactly as toLocaleDateString did, for every day of four years, twice over (cold and cached)', () => {
    let iso = '2024-01-01';
    const days: string[] = [];
    for (let i = 0; i < 1461; i++) {
      days.push(iso);
      iso = addDaysToIsoDate(iso, 1);
    }
    for (const pass of [1, 2]) {
      for (const [name, label, options] of LABELS) {
        for (const day of days) {
          const expected = parseLocalIsoDate(day).toLocaleDateString(undefined, options);
          if (label(day) !== expected)
            throw new Error(`${name} ${day} (pass ${pass}): ${label(day)} != ${expected}`);
        }
      }
    }
  });

  it('makes one formatter per label, however many dates it labels', () => {
    const real = Intl.DateTimeFormat;
    const made = jest.fn();
    (Intl as any).DateTimeFormat = function (...args: ConstructorParameters<typeof real>) {
      made();
      return new real(...args);
    };
    try {
      jest.isolateModules(() => {
        const { weekdayDayMonth: fresh } = require('./dateLabels');
        let iso = '2026-01-01';
        for (let i = 0; i < 400; i++) {
          fresh(iso);
          iso = addDaysToIsoDate(iso, 1);
        }
      });
      expect(made).toHaveBeenCalledTimes(1);
    } finally {
      (Intl as any).DateTimeFormat = real;
    }
  });
});
