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

describe('runMarks', () => {
  const { runMarks } = require('./recurring.helpers');
  const rule = (over: Record<string, unknown>) => ({
    id: 'r',
    type: 'expense',
    nextRunDate: '2026-10-12',
    frequency: 'monthly',
    intervalCount: 1,
    endDate: null,
    amountMinor: 50000,
    ...over,
  });

  it('puts each run in the next 30 days on its own day', () => {
    const marks = runMarks(
      [rule({}), rule({ id: 'w', frequency: 'weekly', nextRunDate: '2026-10-10', amountMinor: 1000 })],
      '2026-10-09'
    );
    expect(
      marks.filter((m: { key: string }) => m.key.startsWith('r-')).map((m: { date: string }) => m.date)
    ).toEqual(['2026-10-12']);
    // The window runs 9 Oct – 7 Nov, both included.
    expect(
      marks.filter((m: { key: string }) => m.key.startsWith('w-')).map((m: { date: string }) => m.date)
    ).toEqual(['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07']);
  });

  it('counts a run already due on today, marks income as coming in, and stops at the end date', () => {
    const marks = runMarks(
      [
        rule({ nextRunDate: '2026-10-01', type: 'income' }),
        rule({ id: 'e', frequency: 'weekly', nextRunDate: '2026-10-10', endDate: '2026-10-18' }),
      ],
      '2026-10-09'
    );
    expect(marks[0]).toMatchObject({ date: '2026-10-09', incoming: true });
    expect(marks.filter((m: { key: string }) => m.key.startsWith('e-'))).toHaveLength(2);
  });

  it("follows a rule's real day: a 31st rule clamped to the 28th lands on the 31st next", () => {
    const marks = runMarks([rule({ nextRunDate: '2027-02-28', anchorDay: 31 })], '2027-02-27');
    expect(marks.map((m: { date: string }) => m.date)).toEqual(['2027-02-28']);
  });
});
