/** The Budgets hero totals. All figures are made up. */
import { budgetsOverview } from './budgetsOverview';

const TODAY = '2026-10-02';

const b = (limit: number, spent: number) => ({
  effectiveLimitMinor: limit,
  spentMinor: spent,
  percentUsed: (spent / limit) * 100,
  overBudget: spent > limit,
});

describe('budgetsOverview', () => {
  it('adds the limits and spend and spreads what is left over the days after today', () => {
    const h = budgetsOverview([b(1000000, 100000), b(500000, 50000)], TODAY);
    expect(h.limitMinor).toBe(1500000);
    expect(h.spentMinor).toBe(150000);
    expect(h.leftMinor).toBe(1350000);
    expect(h.daysLeft).toBe(29);
    expect(h.perDayMinor).toBe(Math.floor(1350000 / 29));
    expect(h.usedPct).toBeCloseTo(10, 5);
    expect(h.expectedPct).toBeCloseTo((2 / 31) * 100, 5);
    expect(h.budgetCount).toBe(2);
    expect(h.tone).toBe('ok');
  });

  it('calls a budget ahead once it is well past the even-spending line', () => {
    const h = budgetsOverview([b(1000000, 800000), b(500000, 10000)], TODAY);
    expect(h.aheadCount).toBe(1);
    expect(h.overCount).toBe(0);
    expect(h.tone).toBe('ahead');
  });

  it('counts an over budget once, as over rather than ahead', () => {
    const h = budgetsOverview([b(1000000, 1200000), b(500000, 10000)], TODAY);
    expect(h.overCount).toBe(1);
    expect(h.aheadCount).toBe(0);
    expect(h.tone).toBe('over');
  });

  it('has nothing left, and no daily figure, when the total is spent', () => {
    const h = budgetsOverview([b(1000000, 1300000)], TODAY);
    expect(h.leftMinor).toBe(0);
    expect(h.overMinor).toBe(300000);
    expect(h.perDayMinor).toBeNull();
    expect(h.usedPct).toBe(100);
  });

  it('has no daily figure on the last day of the month', () => {
    const h = budgetsOverview([b(1000000, 100000)], '2026-10-31');
    expect(h.daysLeft).toBe(0);
    expect(h.perDayMinor).toBeNull();
    expect(h.leftMinor).toBe(900000);
  });

  it('is empty for no budgets', () => {
    expect(budgetsOverview([], TODAY)).toMatchObject({
      limitMinor: 0,
      usedPct: 0,
      budgetCount: 0,
      tone: 'ok',
    });
  });
});
