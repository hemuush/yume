import { planTiles } from './planTiles';

type Input = Parameters<typeof planTiles>[0];

/** Just what the tiles read; every part is overridable. */
const base = (over: Partial<Input> = {}): Input =>
  ({
    hideAmounts: false,
    currency: 'INR',
    budgets: { rows: [], budgetedMinor: 0, usedMinor: 0, overCount: 0, shares: [] },
    goals: [],
    investments: { holdings: [], otherCurrency: [], valueMinor: 0, currency: 'INR' },
    loans: { rows: [], borrowedCount: 0, debtLeftMinor: 0, lentLeftMinor: 0, paidFraction: 0 },
    ...over,
  }) as unknown as Input;

const tile = (input: Input, id: string) => planTiles(input).find((t) => t.id === id)!;

describe('Budgets tile', () => {
  const budgets = (usedMinor: number) =>
    ({
      rows: [{}],
      budgetedMinor: 100000,
      usedMinor,
      overCount: 0,
      shares: [],
    }) as unknown as Input['budgets'];

  it('says what is left of the total, with a bar for what is used', () => {
    const t = tile(base({ budgets: budgets(25000) }), 'budgets');
    expect(t.amount).toBe('₹750');
    expect(t.subtitle).toBe('left of ₹1,000');
    expect(t.progress).toBe(0.25);
    expect(t.over).toBe(false);
  });
  it('turns over when more than the total is used, and shows how far over', () => {
    const t = tile(base({ budgets: budgets(130000) }), 'budgets');
    expect(t.over).toBe(true);
    expect(t.amount).toBe('₹300');
    expect(t.subtitle).toBe('Over planned limits');
  });
  it('has no bar and no figure with no budgets', () => {
    const t = tile(base(), 'budgets');
    expect(t).toMatchObject({ amount: '', subtitle: 'No budgets this month' });
    expect(t.progress).toBeUndefined();
  });
});

describe('Goals tile', () => {
  const goal = (current: number, target: number, archived = false) => ({
    currentAmountMinor: current,
    targetAmountMinor: target,
    archived,
  });
  const goals = (...g: ReturnType<typeof goal>[]) => g as unknown as Input['goals'];

  it('shows the share saved across all active goals, ignoring archived ones', () => {
    const t = tile(
      base({ goals: goals(goal(5000, 10000), goal(0, 10000), goal(9999, 9999, true)) }),
      'goals'
    );
    expect(t).toMatchObject({ amount: '25%', subtitle: '2 in progress', progress: 0.25 });
  });
  it('counts a goal saved past its target as just reached, not more', () => {
    const t = tile(base({ goals: goals(goal(30000, 10000)) }), 'goals');
    expect(t).toMatchObject({ amount: '100%', subtitle: 'All reached', progress: 1 });
  });
  it('shows nothing about the savings while amounts are hidden', () => {
    const t = tile(base({ hideAmounts: true, goals: goals(goal(5000, 10000)) }), 'goals');
    expect(t).toMatchObject({ amount: '', subtitle: 'Savings hidden' });
    expect(t.progress).toBeUndefined();
  });
  it('has no figure and no bar with no goals', () => {
    const t = tile(base(), 'goals');
    expect(t).toMatchObject({ amount: '', subtitle: 'No active goals' });
    expect(t.progress).toBeUndefined();
  });
});

describe('Debt tile', () => {
  const loans = (over: object) =>
    ({
      rows: [{}],
      borrowedCount: 1,
      debtLeftMinor: 75000,
      lentLeftMinor: 0,
      paidFraction: 0.25,
      ...over,
    }) as unknown as Input['loans'];

  it('shows what is left to repay and how much is paid, with a bar', () => {
    const t = tile(base({ loans: loans({}) }), 'debt');
    expect(t).toMatchObject({ amount: '₹750', subtitle: 'to repay · 25% paid', progress: 0.25 });
  });
  it('shows money lent with no repayment bar when nothing is borrowed', () => {
    const t = tile(base({ loans: loans({ borrowedCount: 0, lentLeftMinor: 40000 }) }), 'debt');
    expect(t).toMatchObject({ amount: '₹400', subtitle: 'Money lent' });
    expect(t.progress).toBeUndefined();
  });
});
