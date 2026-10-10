import type { PeriodComparison, PeriodSummary, CategoryBreakdownItem } from '@/db/reports';
import type { Category } from '@/types';
import { privateComparison, privateSummary, isSavingsEntry } from './privateSummary';

function item(categoryId: string, totalMinor: number, isSensitive = false): CategoryBreakdownItem {
  return { categoryId, name: categoryId, color: '#000', totalMinor, hasSubcategories: false, isSensitive };
}

function summary(over: Partial<PeriodSummary>): PeriodSummary {
  return {
    incomeMinor: 0,
    expenseMinor: 0,
    netMinor: 0,
    savingsContributionMinor: 0,
    categoryBreakdown: [],
    incomeBreakdown: [],
    ...over,
  };
}

const comparison: PeriodComparison = {
  period: 'month',
  current: summary({
    expenseMinor: 1000,
    incomeMinor: 5000,
    categoryBreakdown: [item('food', 400), item('sip', 600, true)],
    incomeBreakdown: [item('salary', 4500), item('dividend', 500, true)],
  }),
  previous: summary({
    expenseMinor: 500,
    incomeMinor: 4000,
    categoryBreakdown: [item('food', 200), item('sip', 300, true)],
    incomeBreakdown: [item('salary', 4000)],
  }),
  incomeChangePct: 25,
  expenseChangePct: 100,
};

describe('privateComparison', () => {
  it('returns the comparison itself when nothing is hidden, and passes null through', () => {
    expect(privateComparison(comparison, false)).toBe(comparison);
    expect(privateComparison(null, true)).toBeNull();
  });

  it('drops sensitive categories from totals and rows in both periods', () => {
    const p = privateComparison(comparison, true);
    expect(p.current.expenseMinor).toBe(400);
    expect(p.current.incomeMinor).toBe(4500);
    expect(p.current.categoryBreakdown.map((c) => c.categoryId)).toEqual(['food']);
    expect(p.current.incomeBreakdown.map((c) => c.categoryId)).toEqual(['salary']);
    expect(p.previous.expenseMinor).toBe(200);
  });

  it('recomputes the change figures and net from what is left', () => {
    const p = privateComparison(comparison, true);
    expect(p.expenseChangePct).toBe(100);
    expect(p.incomeChangePct).toBeCloseTo(12.5);
    expect(p.current.netMinor).toBe(4500 - 400);
  });

  it('gives no change figure when the earlier period had nothing left', () => {
    const p = privateComparison(
      {
        ...comparison,
        previous: summary({ expenseMinor: 300, categoryBreakdown: [item('sip', 300, true)] }),
      },
      true
    );
    expect(p.previous.expenseMinor).toBe(0);
    expect(p.expenseChangePct).toBeNull();
  });
});

describe('privateSummary', () => {
  it('only changes anything when hiding', () => {
    expect(privateSummary(comparison.current, false)).toBe(comparison.current);
    expect(privateSummary(comparison.current, true).expenseMinor).toBe(400);
  });
});

describe('isSavingsEntry', () => {
  it('inherits sensitivity from the parent even when the child flag is false', () => {
    const categories = new Map<string, Category>([
      ['parent', { id: 'parent', isSensitive: true } as Category],
      ['child', { id: 'child', parentId: 'parent', isSensitive: false } as Category],
    ]);
    expect(
      isSavingsEntry(
        { type: 'expense', accountId: 'bank', toAccountId: null, categoryId: 'child' },
        categories,
        new Set()
      )
    ).toBe(true);
  });
  const cats = new Map<string, Category>([
    ['sip', { id: 'sip', isSensitive: true } as Category],
    ['food', { id: 'food', isSensitive: false } as Category],
  ]);
  const savings = new Set(['pot']);
  const base = { accountId: 'bank', toAccountId: null, categoryId: null };

  it('flags spending and income in a sensitive category', () => {
    expect(isSavingsEntry({ ...base, type: 'expense', categoryId: 'sip' }, cats, savings)).toBe(true);
    expect(isSavingsEntry({ ...base, type: 'income', categoryId: 'sip' }, cats, savings)).toBe(true);
    expect(isSavingsEntry({ ...base, type: 'expense', categoryId: 'food' }, cats, savings)).toBe(false);
    expect(isSavingsEntry({ ...base, type: 'expense' }, cats, savings)).toBe(false);
  });

  it('flags a transfer into or out of a savings account, but not between ordinary ones', () => {
    expect(isSavingsEntry({ ...base, type: 'transfer', toAccountId: 'pot' }, cats, savings)).toBe(true);
    expect(
      isSavingsEntry({ ...base, type: 'transfer', accountId: 'pot', toAccountId: 'bank2' }, cats, savings)
    ).toBe(true);
    expect(isSavingsEntry({ ...base, type: 'transfer', toAccountId: 'bank2' }, cats, savings)).toBe(false);
  });
});
