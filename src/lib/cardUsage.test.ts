import { cardUsage } from './cardUsage';
import { buildCardCycle, minimumDue, parseMinDue } from './cardCycle';

const card = (balance: number, limit: number | null) => ({
  type: 'credit_card' as const,
  creditLimitMinor: limit,
  currentBalanceMinor: balance,
});

describe('cardUsage', () => {
  it('is how much of the limit is owed, with what is left', () => {
    expect(cardUsage(card(-42_000_00, 120_000_00))).toMatchObject({
      usedMinor: 42_000_00,
      availableMinor: 78_000_00,
      high: true,
    });
    expect(cardUsage(card(-42_000_00, 120_000_00))!.pct).toBeCloseTo(35);
  });
  it('is not high at or under 30%', () => {
    expect(cardUsage(card(-30_000_00, 100_000_00))!.high).toBe(false);
  });
  it('counts a credit balance as nothing used', () => {
    expect(cardUsage(card(5_000_00, 100_000_00))).toMatchObject({ usedMinor: 0, availableMinor: 100_000_00 });
  });
  it('goes negative past the limit', () => {
    expect(cardUsage(card(-110_000_00, 100_000_00))!.availableMinor).toBe(-10_000_00);
  });
  it('is null without a limit or for another account type', () => {
    expect(cardUsage(card(-1000, null))).toBeNull();
    expect(cardUsage(card(-1000, 0))).toBeNull();
    expect(cardUsage({ ...card(-1000, 5000), type: 'bank' as never })).toBeNull();
  });
});

describe('minimumDue', () => {
  it('is the share, but at least the floor, and never more than the statement', () => {
    expect(minimumDue(42_000_00, 500, null)).toBe(2_100_00);
    expect(minimumDue(1_000_00, 500, 200_00)).toBe(200_00);
    expect(minimumDue(150_00, 500, 200_00)).toBe(150_00);
    expect(minimumDue(0, 500, 200_00)).toBe(0);
  });
  it('is null when the card has neither', () => {
    expect(minimumDue(42_000_00, null, null)).toBeNull();
    expect(minimumDue(42_000_00)).toBeNull();
  });
  it('works from a floor alone', () => {
    expect(minimumDue(42_000_00, null, 500_00)).toBe(500_00);
  });
});

describe('buildCardCycle minimum', () => {
  const base = {
    statementDay: 5,
    dueDay: 25,
    today: '2026-10-10',
    owedAtStatementMinor: 42_000_00,
    spentThisCycleMinor: 0,
    minDueBp: 500,
  };
  it('tracks what is left of the minimum after a part payment', () => {
    const cycle = buildCardCycle({ ...base, paidSinceMinor: 1_000_00 });
    expect(cycle.minimumMinor).toBe(2_100_00);
    expect(cycle.leftMinimumMinor).toBe(1_100_00);
    expect(cycle.leftToPayMinor).toBe(41_000_00);
  });
  it('is met once enough is paid', () => {
    expect(buildCardCycle({ ...base, paidSinceMinor: 3_000_00 }).leftMinimumMinor).toBe(0);
  });
  it('has no minimum when the card has none set', () => {
    const cycle = buildCardCycle({ ...base, minDueBp: null, paidSinceMinor: 0 });
    expect(cycle.minimumMinor).toBeNull();
    expect(cycle.leftMinimumMinor).toBeNull();
  });
});

describe('parseMinDue', () => {
  it('reads a share and a floor', () => {
    expect(parseMinDue('5', '200')).toEqual({ minDueBp: 500, minDueFloorMinor: 20_000 });
    expect(parseMinDue('3.5', '')).toEqual({ minDueBp: 350, minDueFloorMinor: null });
  });
  it('allows both to be empty', () => {
    expect(parseMinDue('', ' ')).toEqual({ minDueBp: null, minDueFloorMinor: null });
  });
  it('rejects a share outside 0-100 and anything that is not a number', () => {
    expect(parseMinDue('101', '')).toHaveProperty('error');
    expect(parseMinDue('-1', '')).toHaveProperty('error');
    expect(parseMinDue('abc', '')).toHaveProperty('error');
    expect(parseMinDue('', 'abc')).toHaveProperty('error');
  });
});
