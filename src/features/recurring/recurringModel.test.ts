import type { Account, Category, RecurringRule } from '@/types';
import { buildRecurringModel } from './recurringModel';

const TODAY = '2026-11-15';
const account = (id: string, extra: Partial<Account> = {}) =>
  ({ id, name: id, type: 'bank', currency: 'INR', ...extra }) as Account;
const category = (id: string, extra: Partial<Category> = {}) =>
  ({ id, name: id, kind: 'expense', parentId: null, ...extra }) as Category;
const rule = (id: string, extra: Partial<RecurringRule> = {}) =>
  ({
    id,
    type: 'expense',
    accountId: 'bank',
    toAccountId: null,
    categoryId: 'rent',
    amountMinor: 100_000,
    note: id,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: '2026-11-20',
    endDate: null,
    active: true,
    ...extra,
  }) as RecurringRule;

const base = {
  accounts: [account('bank'), account('nest', { type: 'savings' })],
  categories: [category('rent'), category('sip', { isSensitive: true } as Partial<Category>)],
  currency: 'INR',
  hideAmounts: false,
  todayIso: TODAY,
};

describe('buildRecurringModel', () => {
  it('splits the rules into the running ones, biggest first, and the paused ones', () => {
    const small = rule('small', { amountMinor: 10_000 });
    const big = rule('big', { amountMinor: 900_000 });
    const off = rule('off', { active: false });
    const model = buildRecurringModel({ ...base, rules: [small, off, big] });
    expect(model.activeRules.map((r) => r.id)).toEqual(['big', 'small']);
    expect(model.pausedRules).toEqual([off]);
  });

  it('totals what runs each month, leaving paused rules out', () => {
    const model = buildRecurringModel({
      ...base,
      rules: [rule('a', { amountMinor: 100_000 }), rule('b', { active: false })],
    });
    expect(model.totals).toMatchObject({ monthlyMinor: 100_000, count: 1 });
    expect(model.hasVisibleRules).toBe(true);
  });

  it('finds the next run among the running rules only', () => {
    const model = buildRecurringModel({
      ...base,
      rules: [
        rule('later', { nextRunDate: '2026-12-01' }),
        rule('soon', { nextRunDate: '2026-11-18' }),
        rule('paused', { nextRunDate: '2026-11-16', active: false }),
      ],
    });
    expect(model.nextDate).toBe('2026-11-18');
    expect(buildRecurringModel({ ...base, rules: [] }).nextDate).toBeNull();
  });

  it('masks a rule that moves money into savings while amounts are hidden, and leaves it out of the totals', () => {
    const toSavings = rule('save', { type: 'transfer', toAccountId: 'nest', categoryId: null });
    const shown = buildRecurringModel({ ...base, rules: [rule('rent'), toSavings] });
    expect(shown.masked.size).toBe(0);
    const hidden = buildRecurringModel({ ...base, rules: [rule('rent'), toSavings], hideAmounts: true });
    expect([...hidden.masked]).toEqual(['save']);
    expect(hidden.marks.map((m) => m.key).some((key) => key.startsWith('save-'))).toBe(false);
  });

  it('keeps a rule in another currency out of the totals, and says there are some', () => {
    const model = buildRecurringModel({
      ...base,
      accounts: [account('bank'), account('usd', { currency: 'USD' })],
      rules: [rule('a'), rule('b', { accountId: 'usd' })],
    });
    expect(model.totals.count).toBe(1);
    expect(model.hasOtherCurrencies).toBe(true);
    expect(model.activeRules).toHaveLength(2);
  });

  it('lays the running rules on the 30-day strip', () => {
    const model = buildRecurringModel({ ...base, rules: [rule('a', { nextRunDate: '2026-11-20' })] });
    expect(model.marks.map((m) => m.date)).toContain('2026-11-20');
  });

  it('has nothing visible when there are no rules', () => {
    const model = buildRecurringModel({ ...base, rules: [] });
    expect(model.hasVisibleRules).toBe(false);
    expect(model.hasOtherCurrencies).toBe(false);
  });
});
