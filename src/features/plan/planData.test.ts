/** The Plan page's figures from what was read: the window's payments and runway, privacy, and the what-if. */
import type { Account, Category, RecurringRule, SavingsGoal } from '@/types';
import { buildPlanData, planWindow, type PlanInput } from './planData';

const TODAY = '2026-11-14';
const account = (over: Partial<Account>): Account => ({
  id: 'bank',
  name: 'Bank',
  type: 'bank',
  currency: 'INR',
  openingBalanceMinor: 0,
  currentBalanceMinor: 1_000_000,
  creditLimitMinor: null,
  statementDay: null,
  dueDay: null,
  interestRateAnnualBp: null,
  archived: false,
  createdAt: '2026-01-01',
  ...over,
});
const category = (over: Partial<Category>) =>
  ({
    id: 'food',
    name: 'Food',
    kind: 'expense',
    parentId: null,
    isSensitive: false,
    isSystem: false,
    ...over,
  }) as Category;
const rule = (over: Partial<RecurringRule>) =>
  ({
    id: 'r1',
    type: 'expense',
    accountId: 'bank',
    toAccountId: null,
    categoryId: 'rent',
    amountMinor: 1_800_000,
    note: 'Rent',
    frequency: 'monthly',
    intervalCount: 1,
    anchorDay: null,
    nextRunDate: '2026-11-17',
    nextAmountMinor: null,
    scheduledDate: null,
    endDate: null,
    active: true,
    ...over,
  }) as RecurringRule;

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  hideAmounts: false,
  budgets: [],
  goals: [] as SavingsGoal[],
  rules: [rule({})],
  loans: [],
  progress: [],
  people: [],
  categories: [category({}), category({ id: 'rent', name: 'Rent' })],
  accounts: [account({})],
  dailyGoal: null,
  averages: [],
  cardCycles: [],
  streak: null,
  currency: 'INR',
  loanPayments: [],
  today: TODAY,
  ...over,
});

describe('buildPlanData', () => {
  it('lists the rent due in the window, and starts the runway from the balance of everyday accounts', () => {
    const data = buildPlanData(input());
    expect(data.dueSoon.count).toBe(1);
    expect(data.dueSoon.totalMinor).toBe(1_800_000);
    expect(data.hasAccounts).toBe(true);
    expect(data.runway.startMinor).toBe(1_000_000);
    expect(data.today).toBe(TODAY);
  });

  it('leaves a rule outside the window out of what is due', () => {
    const data = buildPlanData(input({ rules: [rule({ nextRunDate: '2026-12-20' })] }));
    expect(data.dueSoon.count).toBe(0);
  });

  it('adds nothing in another currency to the totals', () => {
    const data = buildPlanData(
      input({
        accounts: [account({}), account({ id: 'usd', currency: 'USD', currentBalanceMinor: 9_999_999 })],
        rules: [rule({ accountId: 'usd' })],
      })
    );
    expect(data.runway.startMinor).toBe(1_000_000);
    expect(data.dueSoon.count).toBe(0);
  });

  it('keeps savings balances out of the payment sheet while amounts are hidden', () => {
    const accounts = [account({}), account({ id: 'pot', type: 'savings', currentBalanceMinor: 5_000_000 })];
    expect(buildPlanData(input({ accounts })).balances.pot).toBe(5_000_000);
    expect(buildPlanData(input({ accounts, hideAmounts: true })).balances).not.toHaveProperty('pot');
  });

  it('offers the biggest ordinary category to cut, never a fixed one, a built-in or (while hidden) a private one', () => {
    const averages = [
      { categoryId: 'rent', name: 'Rent', totalMinor: 9_000_000 },
      { categoryId: 'loan', name: 'Loan EMI', totalMinor: 8_000_000 },
      { categoryId: 'shares', name: 'Shares', totalMinor: 7_000_000, isSensitive: true },
      { categoryId: 'food', name: 'Food', totalMinor: 600_000 },
    ] as PlanInput['averages'];
    const categories = [
      category({ id: 'rent', name: 'Rent' }),
      category({ id: 'loan', name: 'Loan EMI', isSystem: true }),
      category({ id: 'shares', name: 'Shares', isSensitive: true }),
      category({}),
    ];
    expect(buildPlanData(input({ averages, categories })).whatIf).toEqual({
      categoryId: 'shares',
      categoryName: 'Shares',
      avgMonthlyMinor: 7_000_000,
    });
    expect(buildPlanData(input({ averages, categories, hideAmounts: true })).whatIf?.categoryId).toBe('food');
  });

  it('says nothing for the habit without a daily goal', () => {
    const data = buildPlanData(input());
    expect(data.habit).toBeNull();
    expect(data.dailyGoalMinor).toBeNull();
  });
});

describe('planWindow', () => {
  it('is today and the last day of the window', () => {
    expect(planWindow(new Date(2026, 10, 14))).toEqual({ today: '2026-11-14', until: '2026-12-13' });
  });
});
