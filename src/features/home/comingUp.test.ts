/**
 * Coming up: payments, budgets and goals in one list, most pressing first, with a filter and attention flags.
 */
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { buildComingUp, summarizeComingUp, budgetState } from './comingUp';
import type { Upcoming, UpcomingItem } from './upcomingItems';
import type { BudgetProgress } from '@/db/budgets';
import type { SavingsGoal } from '@/types';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';

const today = toLocalIsoDate(new Date());
const inDays = (n: number) => addDaysToIsoDate(today, n);

const payment = (key: string, days: number, over: Partial<UpcomingItem> = {}): UpcomingItem => ({
  key,
  icon: 'calendar',
  iconBg: '#fff',
  title: key,
  subtitle: '',
  amountMinor: 10000,
  sign: '-',
  sortDate: inDays(days),
  route: '/recurring',
  urgent: days <= 0,
  payable: false,
  pinned: days <= 3,
  ...over,
});
const upcoming = (items: UpcomingItem[]): Upcoming => ({ all: items, items, next: null });

const budget = (id: string, percentUsed: number): BudgetProgress =>
  ({
    budget: { id, categoryId: id, periodMonth: today.slice(0, 7), limitAmountMinor: 100000, rollover: false },
    categoryName: id,
    categoryIcon: 'tag',
    categoryColor: '#8FCBFF',
    spentMinor: percentUsed * 1000,
    effectiveLimitMinor: 100000,
    remainingMinor: 100000 - percentUsed * 1000,
    percentUsed,
    overBudget: percentUsed > 100,
  }) as BudgetProgress;

const goal = (id: string, current: number, over: Partial<SavingsGoal> = {}): SavingsGoal =>
  ({
    id,
    name: id,
    targetAmountMinor: 100000,
    currentAmountMinor: current,
    targetDate: null,
    linkedAccountId: null,
    tracksAccount: false,
    noteToSelf: null,
    letterRevealed: false,
    archived: false,
    createdAt: `${inDays(-30)} 10:00:00`,
    ...over,
  }) as SavingsGoal;

const keys = (items: { key: string }[]) => items.map((i) => i.key);

describe('buildComingUp ordering', () => {
  it('puts due-today payments, then a budget over its limit, then bills due soon, then the rest', () => {
    const items = buildComingUp({
      upcoming: upcoming([payment('later', 20), payment('soon', 2), payment('today', 0)]),
      budgets: [budget('over', 130), budget('fine', 10)],
      goals: [goal('slow', 20000, { targetDate: inDays(40) })],
      today,
    });
    expect(keys(items).slice(0, 4)).toEqual(['today', 'budget-over', 'soon', 'goal-slow']);
    expect(items.map((i) => i.kind)).toEqual(['payment', 'budget', 'payment', 'goal', 'budget', 'payment']);
  });

  it('keeps a source’s own order within the same rank', () => {
    const items = buildComingUp({
      upcoming: upcoming([payment('a', 4), payment('b', 5)]),
      budgets: [],
      goals: [],
      today,
    });
    expect(keys(items)).toEqual(['a', 'b']);
  });

  it('lists only outgoing payments inside a month, and skips archived and finished goals', () => {
    const items = buildComingUp({
      upcoming: upcoming([
        payment('salary', 1, { sign: '+' }),
        payment('far', 90),
        payment('free', 2, { amountMinor: 0 }),
        payment('rent', 3),
      ]),
      budgets: [],
      goals: [goal('done', 100000), goal('old', 10, { archived: true }), goal('open', 5000)],
      today,
    });
    expect(keys(items)).toEqual(['rent', 'goal-open']);
  });

  it('falls back to items and next when the full schedule is not given', () => {
    const items = buildComingUp({
      upcoming: { items: [payment('now', 0)], next: payment('next', 10) },
      budgets: [],
      goals: [],
      today,
    });
    expect(keys(items)).toEqual(['now', 'next']);
  });
});

describe('budgetState', () => {
  it('is over past the limit, ahead when well past an even pace, otherwise ok', () => {
    expect(budgetState(budget('a', 120), '2026-10-10')).toBe('over');
    expect(budgetState(budget('a', 90), '2026-10-10')).toBe('ahead');
    expect(budgetState(budget('a', 20), '2026-10-10')).toBe('ok');
  });
});

describe('summarizeComingUp', () => {
  const all = buildComingUp({
    upcoming: upcoming([payment('p1', 1), payment('p2', 2), payment('p3', 3), payment('p4', 25)]),
    budgets: [budget('b1', 130), budget('b2', 5)],
    goals: [goal('g1', 1000, { targetDate: inDays(20) }), goal('g2', 50000)],
    today,
  });

  it('shows three payments, one budget and one goal on All, and up to five of one kind when filtered', () => {
    const many = buildComingUp({
      upcoming: upcoming([1, 2, 3, 4, 5, 6].map((d) => payment(`p${d}`, d))),
      budgets: [budget('b1', 130), budget('b2', 90), budget('b3', 5)],
      goals: [goal('g1', 1000, { targetDate: inDays(20) }), goal('g2', 50000)],
      today,
    });
    const rows = summarizeComingUp(many, 'all').visible;
    expect(rows.map((i) => i.kind).sort()).toEqual(['budget', 'goal', 'payment', 'payment', 'payment']);
    expect(keys(rows)).toContain('budget-b1');
    expect(summarizeComingUp(many, 'payment').visible).toHaveLength(5);
    expect(summarizeComingUp(many, 'budget').visible).toHaveLength(3);
    expect(summarizeComingUp(many, 'goal').visible).toHaveLength(2);
  });

  it('fills the slots a short kind leaves with the next most pressing rows', () => {
    const noGoals = buildComingUp({
      upcoming: upcoming([payment('p1', 1), payment('p2', 2)]),
      budgets: [budget('b1', 130), budget('b2', 90), budget('b3', 80), budget('b4', 5)],
      goals: [],
      today,
    });
    expect(summarizeComingUp(noGoals, 'all').visible).toHaveLength(5);
    expect(summarizeComingUp(noGoals, 'all').visible.filter((i) => i.kind === 'budget')).toHaveLength(3);
  });

  it('counts each kind and flags the ones that need a look', () => {
    const { counts, attention } = summarizeComingUp(all, 'all');
    expect(counts).toEqual({ payment: 4, budget: 2, goal: 2 });
    expect(attention).toEqual({ payment: true, budget: true, goal: true });
  });

  it('flags nothing when everything is calm', () => {
    const calm = buildComingUp({
      upcoming: upcoming([payment('far', 25)]),
      budgets: [budget('fine', 5)],
      goals: [goal('ahead', 90000)],
      today,
    });
    expect(summarizeComingUp(calm, 'all').attention).toEqual({ payment: false, budget: false, goal: false });
  });
});
