import { projectedMonthlySpend, projectGoalPace } from './whatIf';

describe('projectedMonthlySpend', () => {
  it('applies a percentage cut', () => {
    expect(projectedMonthlySpend(620000, 20)).toEqual({ extraMinor: 124000, newMonthlyMinor: 496000 });
  });

  it('a 0% cut changes nothing', () => {
    expect(projectedMonthlySpend(500000, 0)).toEqual({ extraMinor: 0, newMonthlyMinor: 500000 });
  });

  it('never lets the new monthly figure go negative', () => {
    expect(projectedMonthlySpend(1000, 150)).toEqual({ extraMinor: 1500, newMonthlyMinor: 0 });
  });
});

describe('projectGoalPace', () => {
  it('already-reached goal projects today with no change', () => {
    const result = projectGoalPace(
      { currentAmountMinor: 500000, targetAmountMinor: 400000, createdAt: '2026-01-01 10:00:00' },
      50000,
      '2026-06-01'
    );
    expect(result.alreadyDone).toBe(true);
    expect(result.currentEtaDate).toBe('2026-06-01');
    expect(result.newEtaDate).toBe('2026-06-01');
    expect(result.daysSooner).toBe(0);
  });

  it('a goal with zero progress and no extra amount has no projectable date', () => {
    const result = projectGoalPace(
      { currentAmountMinor: 0, targetAmountMinor: 100000, createdAt: '2026-01-01 10:00:00' },
      0,
      '2026-01-15'
    );
    expect(result.currentEtaDate).toBeNull();
    expect(result.newEtaDate).toBeNull();
    expect(result.daysSooner).toBe(0);
  });

  it('adding an extra monthly amount moves the projected date earlier', () => {
    // 30 days in, 30,000 saved toward a 120,000 target -> ~30,000/month pace.
    const result = projectGoalPace(
      { currentAmountMinor: 30000, targetAmountMinor: 120000, createdAt: '2026-01-01 10:00:00' },
      15000,
      '2026-01-31'
    );
    expect(result.currentEtaDate).not.toBeNull();
    expect(result.newEtaDate).not.toBeNull();
    expect(result.newEtaDate! <= result.currentEtaDate!).toBe(true);
    expect(result.daysSooner).toBeGreaterThan(0);
  });

  it('zero current rate but a positive extra amount still projects a date', () => {
    const result = projectGoalPace(
      { currentAmountMinor: 0, targetAmountMinor: 60000, createdAt: '2026-01-01 10:00:00' },
      20000,
      '2026-01-15'
    );
    expect(result.currentEtaDate).toBeNull();
    expect(result.newEtaDate).not.toBeNull();
  });
});
