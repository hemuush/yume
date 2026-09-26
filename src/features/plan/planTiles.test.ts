import { buildPlanTiles, PlanInput } from './planTiles';

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  budgets: [],
  goals: [],
  recurring: [],
  nextEmiDueDate: null,
  activeLoanCount: 0,
  people: [],
  gardenStreakDays: null,
  // Dates in these fixtures encode their own distance: 'd+N' = N days away.
  daysUntil: (iso) => Number(iso.replace('d', '')),
  money: (minor) => `₹${minor / 100}`,
  ...over,
});
const line = (input: PlanInput, key: string) => buildPlanTiles(input).find((t) => t.key === key)!.line;

describe('buildPlanTiles', () => {
  it('always returns the seven tiles, in order, each pointing at its screen', () => {
    expect(buildPlanTiles(base()).map((t) => [t.key, t.route])).toEqual([
      ['budgets', '/budgets'],
      ['goals', '/savings-goals'],
      ['recurring', '/recurring'],
      ['whatif', '/whatif'],
      ['loans', '/loans'],
      ['people', '/people'],
      ['garden', '/garden'],
    ]);
  });

  it('makes only the last, odd tile full-width', () => {
    expect(
      buildPlanTiles(base())
        .filter((t) => t.wide)
        .map((t) => t.key)
    ).toEqual(['garden']);
  });

  it('invites a first step when a feature is unused', () => {
    const tiles = buildPlanTiles(base());
    expect(tiles.map((t) => t.line)).toEqual([
      'Set a monthly limit',
      'Save toward something',
      'Rent, salary, subscriptions',
      'Try a spending cut',
      'Track an EMI',
      'Track money with friends',
      'Set a daily goal',
    ]);
  });

  it('counts budgets below 90% and not over as on track', () => {
    const budgets = [
      { percentUsed: 40, overBudget: false },
      { percentUsed: 89.9, overBudget: false },
      { percentUsed: 90, overBudget: false },
      { percentUsed: 120, overBudget: true },
    ];
    expect(line(base({ budgets }), 'budgets')).toBe('2 of 4 on track');
  });

  it('shows the active goal closest to done, floored so 99.9% never reads 100%', () => {
    const goals = [
      { name: 'Laptop', currentAmountMinor: 10000, targetAmountMinor: 100000, archived: false },
      { name: 'Goa trip', currentAmountMinor: 99900, targetAmountMinor: 100000, archived: false },
      { name: 'Old car', currentAmountMinor: 100000, targetAmountMinor: 100000, archived: true },
    ];
    expect(line(base({ goals }), 'goals')).toBe('Goa trip · 99%');
  });

  it('shows the soonest active recurring rule, skipping paused ones', () => {
    const recurring = [
      { active: true, nextRunDate: 'd5', label: 'Rent' },
      { active: false, nextRunDate: 'd0', label: 'Gym' },
      { active: true, nextRunDate: 'd1', label: 'Netflix' },
    ];
    expect(line(base({ recurring }), 'recurring')).toBe('Netflix due tomorrow');
  });

  it('leads loans with the next EMI, otherwise counts open loans', () => {
    expect(line(base({ nextEmiDueDate: 'd0', activeLoanCount: 2 }), 'loans')).toBe('Next EMI due today');
    expect(line(base({ nextEmiDueDate: 'd-3' }), 'loans')).toBe('Next EMI overdue');
    expect(line(base({ nextEmiDueDate: 'd12' }), 'loans')).toBe('Next EMI in 12 days');
    expect(line(base({ activeLoanCount: 1 }), 'loans')).toBe('1 loan');
    expect(line(base({ activeLoanCount: 3 }), 'loans')).toBe('3 loans');
  });

  it('says what friends & family owe, each way, on whole-rupee totals', () => {
    const people = (...b: number[]) => base({ people: b.map((balanceMinor) => ({ balanceMinor })) });
    expect(line(people(90000, 30000), 'people')).toBe('₹1200 owed to you');
    expect(line(people(-30000), 'people')).toBe('You owe ₹300');
    expect(line(people(120000, -30000), 'people')).toBe('₹1200 to you · you owe ₹300');
    // 40 paise rounds to ₹0, so it reads as settled, like the person's row.
    expect(line(people(0, 40), 'people')).toBe('All settled up');
  });

  it("shows the garden streak once there's a daily goal", () => {
    expect(line(base({ gardenStreakDays: 4 }), 'garden')).toBe('4-day streak');
    expect(line(base({ gardenStreakDays: 0 }), 'garden')).toBe('0-day streak');
  });
});
