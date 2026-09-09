import {
  getPeriodRanges,
  findTopGrowingCategory,
  loanNetWorthContribution,
  computeTrackedBalance,
  CategoryBreakdownItem,
} from './reports';

describe('getPeriodRanges', () => {
  it('day: previous is exactly one day before the reference', () => {
    const { current, previous } = getPeriodRanges('day', new Date('2024-03-01T12:00:00'));
    expect(current).toEqual({ start: '2024-03-01', end: '2024-03-01' });
    expect(previous).toEqual({ start: '2024-02-29', end: '2024-02-29' }); // crosses a leap-year boundary correctly
  });

  it('week: current starts on Sunday and spans 7 days, previous is the week immediately before', () => {
    const { current, previous } = getPeriodRanges('week', new Date('2024-03-06T12:00:00')); // a Wednesday
    expect(current).toEqual({ start: '2024-03-03', end: '2024-03-09' });
    expect(previous).toEqual({ start: '2024-02-25', end: '2024-03-02' });
  });

  it('month: handles a December reference by rolling previous into the prior year', () => {
    const { current, previous } = getPeriodRanges('month', new Date('2024-12-15T12:00:00'));
    expect(current).toEqual({ start: '2024-12-01', end: '2024-12-31' });
    expect(previous).toEqual({ start: '2024-11-01', end: '2024-11-30' });
  });

  it('month: handles a January reference by rolling previous into the prior year', () => {
    const { current, previous } = getPeriodRanges('month', new Date('2024-01-15T12:00:00'));
    expect(current).toEqual({ start: '2024-01-01', end: '2024-01-31' });
    expect(previous).toEqual({ start: '2023-12-01', end: '2023-12-31' });
  });

  it('year: current and previous are full calendar years', () => {
    const { current, previous } = getPeriodRanges('year', new Date('2024-06-15T12:00:00'));
    expect(current).toEqual({ start: '2024-01-01', end: '2024-12-31' });
    expect(previous).toEqual({ start: '2023-01-01', end: '2023-12-31' });
  });
});

describe('findTopGrowingCategory', () => {
  const cat = (categoryId: string, name: string, totalMinor: number): CategoryBreakdownItem => ({
    categoryId,
    name,
    color: '#000000',
    totalMinor,
    hasSubcategories: false,
    isSensitive: false,
  });

  it('flags the category that grew the most, above the 20% threshold', () => {
    const current = [cat('1', 'Food', 12000), cat('2', 'Travel', 5000)];
    const previous = [cat('1', 'Food', 10000), cat('2', 'Travel', 4900)]; // Food +20% exactly, Travel +2%
    const result = findTopGrowingCategory(current, previous);
    expect(result).toBeNull(); // 20% growth is not > 20%, boundary excluded
  });

  it('returns the single category strictly over 20% growth', () => {
    const current = [cat('1', 'Food', 13000), cat('2', 'Travel', 5000)];
    const previous = [cat('1', 'Food', 10000), cat('2', 'Travel', 4900)];
    const result = findTopGrowingCategory(current, previous);
    expect(result).toEqual({ categoryId: '1', name: 'Food', pctChange: 30 });
  });

  it('picks the larger grower when multiple categories exceed 20%', () => {
    const current = [cat('1', 'Food', 13000), cat('2', 'Travel', 10000)];
    const previous = [cat('1', 'Food', 10000), cat('2', 'Travel', 5000)]; // Food +30%, Travel +100%
    const result = findTopGrowingCategory(current, previous);
    expect(result?.name).toBe('Travel');
  });

  it('skips categories with no prior-period spend (nothing to compare against)', () => {
    const current = [cat('1', 'NewCategory', 5000)];
    const previous: CategoryBreakdownItem[] = [];
    expect(findTopGrowingCategory(current, previous)).toBeNull();
  });

  it('returns null when nothing grew past the threshold', () => {
    const current = [cat('1', 'Food', 10500)];
    const previous = [cat('1', 'Food', 10000)];
    expect(findTopGrowingCategory(current, previous)).toBeNull();
  });
});

describe('loanNetWorthContribution', () => {
  it('a borrowed loan is a liability — negative contribution', () => {
    expect(loanNetWorthContribution('borrowed', 500000_00, 100000_00)).toBe(-400000_00);
  });

  it('a lent loan is an asset — positive contribution', () => {
    expect(loanNetWorthContribution('lent', 500000_00, 100000_00)).toBe(400000_00);
  });

  it('a fully paid loan contributes nothing either way', () => {
    expect(loanNetWorthContribution('borrowed', 100000, 100000)).toBe(0);
    expect(loanNetWorthContribution('lent', 100000, 100000)).toBe(0);
  });

  it('never goes negative-outstanding if paid exceeds principal (e.g. rounding)', () => {
    expect(loanNetWorthContribution('borrowed', 100000, 100050)).toBe(0);
  });

  it('a borrowed loan with a tracked asset value nets to real equity, not just the debt', () => {
    // ₹35L home, ₹22L still owed → ₹13L of real equity, not -₹22L of pure debt.
    expect(loanNetWorthContribution('borrowed', 2200000_00, 0, 3500000_00)).toBe(1300000_00);
    // Underwater: owes more than the asset is currently worth.
    expect(loanNetWorthContribution('borrowed', 2200000_00, 0, 1800000_00)).toBe(-400000_00);
    // Fully paid off with a tracked asset — the asset's full value counts, not zero.
    expect(loanNetWorthContribution('borrowed', 2200000_00, 2200000_00, 3500000_00)).toBe(3500000_00);
  });

  it('an asset value is ignored for a lent loan — lending money never leaves you holding an asset', () => {
    expect(loanNetWorthContribution('lent', 500000_00, 100000_00, 999999_00)).toBe(400000_00);
  });

  it('omitting the asset value reproduces the original always-a-liability behavior exactly', () => {
    expect(loanNetWorthContribution('borrowed', 500000_00, 100000_00)).toBe(-400000_00);
  });
});

describe('computeTrackedBalance', () => {
  const acc = (currency: string, currentBalanceMinor: number) => ({ currency, currentBalanceMinor });
  const loan = (
    direction: 'borrowed' | 'lent',
    status: 'active' | 'closed' | 'defaulted',
    outstandingPrincipalMinor: number,
    assetValueMinor: number | null = null
  ) => ({ direction, status, outstandingPrincipalMinor, assetValueMinor });

  it('sums only default-currency account balances', () => {
    const result = computeTrackedBalance({
      accounts: [acc('INR', 100_00), acc('USD', 5000_00), acc('INR', -30_00)],
      loans: [],
      people: [],
      defaultCurrency: 'INR',
    });
    expect(result).toBe(70_00);
  });

  it('subtracts a borrowed loan, adds a lent one, and applies a tracked asset value', () => {
    const result = computeTrackedBalance({
      accounts: [acc('INR', 0)],
      loans: [
        loan('borrowed', 'active', 2000_00),
        loan('lent', 'active', 500_00),
        loan('borrowed', 'active', 1000_00, 3000_00),
      ],
      people: [],
      defaultCurrency: 'INR',
    });
    // -2000 + 500 + (3000 - 1000) = 500
    expect(result).toBe(500_00);
  });

  it('still counts a defaulted loan, but drops a fully closed one', () => {
    const result = computeTrackedBalance({
      accounts: [],
      loans: [loan('borrowed', 'defaulted', 1500_00), loan('borrowed', 'closed', 0)],
      people: [],
      defaultCurrency: 'INR',
    });
    expect(result).toBe(-1500_00);
  });

  it('adds the net of every friends-and-family balance', () => {
    const result = computeTrackedBalance({
      accounts: [acc('INR', 1000_00)],
      loans: [],
      people: [{ balanceMinor: 200_00 }, { balanceMinor: -50_00 }],
      defaultCurrency: 'INR',
    });
    expect(result).toBe(1150_00);
  });
});
