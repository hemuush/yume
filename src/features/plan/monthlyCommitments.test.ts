import { monthlyCommitments, type MonthlyPlanInput } from './monthlyCommitments';
import type { Category, Account, RecurringRule, SavingsGoal } from '@/types';
const category = (id: string, parentId: string | null = null) =>
  ({ id, name: id, kind: 'expense', parentId }) as Category;
const account = (id: string, type = 'bank') => ({ id, type, currency: 'INR' }) as Account;
const rule = (id: string, amountMinor: number, extra: Partial<RecurringRule> = {}) =>
  ({
    id,
    type: 'expense',
    categoryId: 'food',
    accountId: 'bank',
    amountMinor,
    active: true,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: '2026-10-20',
    endDate: null,
    ...extra,
  }) as RecurringRule;
const goal = (id: string, extra: Partial<SavingsGoal> = {}) =>
  ({
    id,
    currentAmountMinor: 0,
    targetAmountMinor: 12000,
    targetDate: '2026-11-20',
    createdAt: '2026-01-01',
    linkedAccountId: 'save',
    tracksAccount: false,
    archived: false,
    ...extra,
  }) as SavingsGoal;
const base = (): MonthlyPlanInput => ({
  categories: [category('food'), category('dining', 'food')],
  accounts: [account('bank'), account('save', 'savings')],
  rules: [],
  budgets: [],
  goals: [],
  loans: [],
  today: '2026-10-20',
});
it('covers child budgets and matching recurring bills inside parent budgets', () => {
  const input = base();
  input.budgets = [
    { categoryId: 'food', limitMinor: 50000 },
    { categoryId: 'dining', limitMinor: 10000 },
  ];
  input.rules = [rule('r', 8000, { categoryId: 'dining' })];
  expect(monthlyCommitments(input).spendingMinor).toBe(50000);
  input.rules.push(rule('r2', 60000));
  expect(monthlyCommitments(input).spendingMinor).toBe(70000);
});
it('covers goal funding by matching savings transfers without counting both', () => {
  const input = base();
  input.rules = [rule('transfer', 20000, { type: 'transfer', toAccountId: 'save', categoryId: null })];
  input.goals = [goal('g')];
  expect(monthlyCommitments(input).savingsMinor).toBe(20000);
  input.goals.push(goal('g2'));
  expect(monthlyCommitments(input).savingsMinor).toBe(24000);
});
it('uses the largest target when multiple goals follow the same account', () => {
  const input = base();
  input.goals = [
    goal('g', { tracksAccount: true }),
    goal('g2', { tracksAccount: true, targetAmountMinor: 20000 }),
  ];
  expect(monthlyCommitments(input).savingsMinor).toBe(20000);
});
it('does not treat card repayments as additional monthly spending', () => {
  const input = base();
  input.accounts.push(account('card', 'credit_card'));
  input.rules = [rule('card', 20000, { type: 'transfer', toAccountId: 'card' })];
  expect(monthlyCommitments(input).totalMinor).toBe(0);
});
it('flags missing loan schedules and unfinished goals without deadlines', () => {
  const input = base();
  input.loans = [{ direction: 'borrowed', nextEmiMinor: null }];
  input.goals = [goal('g', { targetDate: null })];
  expect(monthlyCommitments(input)).toMatchObject({ incompleteLoans: 1, undatedGoals: 1 });
});
it('ignores ended rules and keeps recurring income separate from spending', () => {
  const input = base();
  input.rules = [
    rule('expired', 10000, { endDate: '2026-10-01' }),
    rule('income', 80000, { type: 'income' }),
  ];
  expect(monthlyCommitments(input)).toMatchObject({ spendingMinor: 0, incomeMinor: 80000 });
});
