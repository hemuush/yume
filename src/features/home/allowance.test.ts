import { dailyAllowance, daysLeftInMonth } from './allowance';

describe('daysLeftInMonth', () => {
  it('counts the days still to come, not today', () => {
    expect(daysLeftInMonth(new Date(2026, 9, 22))).toBe(9);
    expect(daysLeftInMonth(new Date(2026, 9, 31))).toBe(0);
    expect(daysLeftInMonth(new Date(2026, 1, 1))).toBe(27);
  });
});

describe('dailyAllowance', () => {
  it('spreads what is free over the days left, rounded to the unit', () => {
    expect(dailyAllowance(95_200, 9)).toBe(10_578);
  });
  it('is null with nothing free or no days left', () => {
    expect(dailyAllowance(0, 9)).toBeNull();
    expect(dailyAllowance(-500, 9)).toBeNull();
    expect(dailyAllowance(95_200, 0)).toBeNull();
  });
});
