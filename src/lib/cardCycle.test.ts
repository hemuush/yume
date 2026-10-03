/**
 * A credit card's cycle: current statement, bill due date, what's left to pay, and month-end cases
 * (a 31st in a 30-day month, February). All figures are made up.
 */
import {
  lastStatementDate,
  nextStatementDate,
  dueDateFor,
  buildCardCycle,
  cycleDates,
  isCycleDay,
  parseCycleDays,
} from './cardCycle';

describe('statement dates', () => {
  it('is this month once the day has come, last month before it', () => {
    expect(lastStatementDate(5, '2026-09-27')).toBe('2026-09-05');
    expect(lastStatementDate(5, '2026-09-05')).toBe('2026-09-05');
    expect(lastStatementDate(5, '2026-09-04')).toBe('2026-08-05');
  });

  it('falls on the last day of a short month', () => {
    expect(lastStatementDate(31, '2026-09-30')).toBe('2026-09-30');
    expect(lastStatementDate(31, '2026-03-01')).toBe('2026-02-28');
    expect(nextStatementDate(31, '2026-01-31')).toBe('2026-02-28');
  });

  it('crosses the year', () => {
    expect(lastStatementDate(20, '2026-01-10')).toBe('2025-12-20');
    expect(nextStatementDate(20, '2025-12-20')).toBe('2026-01-20');
  });
});

describe('due date', () => {
  it('is later the same month when the due day comes after the statement day', () => {
    expect(dueDateFor(25, '2026-09-05')).toBe('2026-09-25');
  });
  it('is next month when it comes before', () => {
    expect(dueDateFor(2, '2026-09-20')).toBe('2026-10-02');
  });
  it('is next month when both are the same day', () => {
    expect(dueDateFor(20, '2026-09-20')).toBe('2026-10-20');
  });
});

describe('buildCardCycle', () => {
  const base = { statementDay: 5, dueDay: 25, today: '2026-09-22' };

  it('works out what is left to pay on the last statement', () => {
    const c = buildCardCycle({
      ...base,
      owedAtStatementMinor: 1_230_000,
      paidSinceMinor: 800_000,
      spentThisCycleMinor: 842_000,
    });
    expect(c).toMatchObject({
      statementDate: '2026-09-05',
      cycleStart: '2026-09-06',
      cycleEnd: '2026-10-05',
      dueDate: '2026-09-25',
      statementMinor: 1_230_000,
      leftToPayMinor: 430_000,
      daysUntilDue: 3,
      spentThisCycleMinor: 842_000,
    });
  });

  it('is nothing left to pay once paid in full, even overpaid', () => {
    const c = buildCardCycle({
      ...base,
      owedAtStatementMinor: 500_000,
      paidSinceMinor: 600_000,
      spentThisCycleMinor: 0,
    });
    expect(c.leftToPayMinor).toBe(0);
  });

  it('owes nothing when the card was in credit on the statement day', () => {
    const c = buildCardCycle({
      ...base,
      owedAtStatementMinor: -20_000,
      paidSinceMinor: 0,
      spentThisCycleMinor: 0,
    });
    expect(c.statementMinor).toBe(0);
    expect(c.leftToPayMinor).toBe(0);
  });

  it('counts days past the due date as negative', () => {
    const c = buildCardCycle({
      ...base,
      today: '2026-09-28',
      owedAtStatementMinor: 500_000,
      paidSinceMinor: 0,
      spentThisCycleMinor: 0,
    });
    expect(c.daysUntilDue).toBe(-3);
  });
});

describe('cycleDates and isCycleDay', () => {
  it('gives the cycle around today', () => {
    expect(cycleDates(5, 25, '2026-10-01')).toEqual({
      statementDate: '2026-09-05',
      cycleStart: '2026-09-06',
      cycleEnd: '2026-10-05',
      dueDate: '2026-09-25',
    });
  });
  it('accepts 1 to 31 only', () => {
    expect([0, 1, 15, 31, 32, 2.5].map(isCycleDay)).toEqual([false, true, true, true, false, false]);
  });
});

describe('parseCycleDays', () => {
  it('takes both days, or neither', () => {
    expect(parseCycleDays('5', '25')).toEqual({ statementDay: 5, dueDay: 25 });
    expect(parseCycleDays(' ', '')).toEqual({ statementDay: null, dueDay: null });
  });
  it('asks for both when only one is filled in', () => {
    expect(parseCycleDays('5', '')).toHaveProperty('error');
    expect(parseCycleDays('', '25')).toHaveProperty('error');
  });
  it('turns away days that are not 1 to 31', () => {
    expect(parseCycleDays('0', '25')).toHaveProperty('error');
    expect(parseCycleDays('5', '32')).toHaveProperty('error');
    expect(parseCycleDays('5.5', '25')).toHaveProperty('error');
    expect(parseCycleDays('abc', '25')).toHaveProperty('error');
  });
});
