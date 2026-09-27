import { monthPace, budgetPace, PACE_MIN_DAY } from './pace';

describe('monthPace', () => {
  it('carries everyday spending per day over the days left, and adds what is still due', () => {
    // ₹90,000 spent by the 26th, ₹65,000 of it everyday (₹2,500 a day), ₹1,000 still due.
    expect(
      monthPace({
        spentMinor: 9_000_000,
        everydaySpentMinor: 6_500_000,
        dueRestOfMonthMinor: 100_000,
        today: '2026-09-26',
      })
    ).toBe(9_000_000 + 250_000 * 4 + 100_000);
  });

  it('is just what was spent on the last day of the month, plus nothing', () => {
    expect(
      monthPace({
        spentMinor: 5_000_000,
        everydaySpentMinor: 4_000_000,
        dueRestOfMonthMinor: 0,
        today: '2026-09-30',
      })
    ).toBe(5_000_000);
  });

  it(`has nothing to say before day ${PACE_MIN_DAY}`, () => {
    expect(
      monthPace({
        spentMinor: 2_000_000,
        everydaySpentMinor: 100_000,
        dueRestOfMonthMinor: 0,
        today: '2026-09-04',
      })
    ).toBeNull();
  });

  it("doesn't let a big EMI early in the month inflate the forecast", () => {
    // An ₹18,000 EMI on the 5th plus ₹500 a day of everyday spending, on the 10th of a 30-day month.
    const pace = monthPace({
      spentMinor: 1_800_000 + 500_000,
      everydaySpentMinor: 500_000,
      dueRestOfMonthMinor: 0,
      today: '2026-09-10',
    });
    expect(pace).toBe(2_300_000 + 50_000 * 20);
  });
});

describe('budgetPace', () => {
  it('marks where even spending would be by today', () => {
    expect(budgetPace(0, '2026-09-15').expectedFraction).toBe(0.5);
  });

  it('is on track at or near the line, ahead well past it, and over past the limit', () => {
    expect(budgetPace(0.88, '2026-09-26').state).toBe('onTrack'); // 88% vs 87%
    expect(budgetPace(0.97, '2026-09-10').state).toBe('ahead'); // 97% vs 33%
    expect(budgetPace(4.38, '2026-09-26').state).toBe('over');
  });

  it('treats exactly the limit as still within it', () => {
    expect(budgetPace(1, '2026-09-30').state).toBe('onTrack');
    expect(budgetPace(Infinity, '2026-09-30').state).toBe('over'); // a zero limit with spending
  });
});
