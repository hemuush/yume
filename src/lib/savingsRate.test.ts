import { savingsRatePct, savingsRateLabel } from './savingsRate';

describe('savingsRatePct', () => {
  it('is income-not-spent as a percentage of income', () => {
    expect(savingsRatePct(13_576_400, 18_926_000)).toBeCloseTo(71.73, 1);
  });

  it('is 0 when income is 0 or negative (avoids divide-by-zero)', () => {
    expect(savingsRatePct(5000, 0)).toBe(0);
    expect(savingsRatePct(5000, -100)).toBe(0);
  });

  it('goes negative when spending exceeds income', () => {
    expect(savingsRatePct(-50_000, 100_000)).toBe(-50);
  });
});

describe('savingsRateLabel', () => {
  it('rounds to a whole percent in the normal range', () => {
    expect(savingsRateLabel(71.73)).toBe('72%');
    expect(savingsRateLabel(-12.4)).toBe('-12%');
  });

  it('collapses the extremes so the text stays legible', () => {
    expect(savingsRateLabel(1500)).toBe('>999%');
    expect(savingsRateLabel(-2000)).toBe('<-999%');
  });
});
