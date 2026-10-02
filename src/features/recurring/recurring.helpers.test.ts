import { Category, RecurringRule } from '@/types';
import { costShares, sortRunning, topShareLine } from './recurring.helpers';

const rule = (over: Partial<RecurringRule>): RecurringRule =>
  ({
    id: 'r',
    type: 'expense',
    accountId: 'a',
    toAccountId: null,
    categoryId: 'c',
    amountMinor: 100000,
    note: '',
    paymentMode: null,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: '2026-11-01',
    endDate: null,
    active: true,
    ...over,
  }) as RecurringRule;

const cats = new Map<string, Category>([
  ['rent', { id: 'rent', name: 'Rent', color: '#FBF0CE' } as Category],
  ['wifi', { id: 'wifi', name: 'Wifi', color: '#EAF3FE' } as Category],
]);

describe('sortRunning', () => {
  it('puts expenses first, then income, then transfers, biggest month first within each', () => {
    const sorted = sortRunning([
      rule({ id: 'transfer', type: 'transfer', amountMinor: 900000 }),
      rule({ id: 'small', amountMinor: 10000 }),
      rule({ id: 'income', type: 'income', amountMinor: 4800000 }),
      rule({ id: 'big', amountMinor: 500000 }),
      rule({ id: 'yearly', amountMinor: 120000, frequency: 'yearly' }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['big', 'small', 'yearly', 'income', 'transfer']);
  });
});

describe('costShares', () => {
  it('counts only running expense rules, at their monthly share, biggest first', () => {
    const shares = costShares(
      [
        rule({ id: 'w', categoryId: 'wifi', amountMinor: 25000 }),
        rule({ id: 'r', categoryId: 'rent', amountMinor: 75000 }),
        rule({ id: 'p', categoryId: 'rent', amountMinor: 999, active: false }),
        rule({ id: 'i', type: 'income', amountMinor: 999 }),
      ],
      cats
    );
    expect(shares.map((s) => [s.name, s.minor])).toEqual([
      ['Rent', 75000],
      ['Wifi', 25000],
    ]);
  });

  it('says the biggest slice in words, and nothing for one', () => {
    const two = costShares(
      [
        rule({ id: 'w', categoryId: 'wifi', amountMinor: 25000 }),
        rule({ id: 'r', categoryId: 'rent', amountMinor: 75000 }),
      ],
      cats
    );
    expect(topShareLine(two)).toBe('Rent is 75% of it');
    expect(topShareLine(two.slice(0, 1))).toBeNull();
  });
});
