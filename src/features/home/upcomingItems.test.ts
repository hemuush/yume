/**
 * Home's Upcoming list: the next 7 days of every loan's next EMI, recurring
 * rule and card bill, soonest first (overdue on top), each pointing where it lives.
 */
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { buildUpcomingItems, UPCOMING_DAYS } from './HomeGlance';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { RecurringRule } from '@/types';

const inDays = (n: number) => addDaysToIsoDate(toLocalIsoDate(new Date()), n);

const rule = (over: Partial<RecurringRule>): RecurringRule => ({
  id: 'r',
  type: 'expense',
  accountId: 'bank',
  toAccountId: null,
  categoryId: 'subs',
  amountMinor: 29900,
  note: '',
  paymentMode: null,
  frequency: 'monthly',
  intervalCount: 1,
  nextRunDate: inDays(3),
  endDate: null,
  active: true,
  ...over,
});

const base = {
  loans: [],
  cardBills: [],
  rules: [],
  accent: '#8CCED6',
  accountName: (id: string | null | undefined) => ({ bank: 'Bank', pot: 'Pot' })[id ?? ''],
  categoryName: (id: string | null) => (id === 'subs' ? 'Subscriptions' : undefined),
};

describe('buildUpcomingItems', () => {
  it('merges every loan, rule and card bill, soonest first, leaving paused rules out', () => {
    const { items } = buildUpcomingItems({
      ...base,
      loans: [
        { id: 'home', name: 'Home loan', nextDueDate: inDays(4), nextEmiMinor: 1800000 },
        { id: 'car', name: 'Car loan', nextDueDate: inDays(1), nextEmiMinor: 845000 },
      ],
      cardBills: [
        { accountId: 'card', accountName: 'Blue Card', dueDate: inDays(6), leftToPayMinor: 642000 },
      ],
      rules: [
        rule({ id: 'stream' }),
        rule({ id: 'salary', type: 'income', nextRunDate: inDays(2), note: 'Salary' }),
        rule({ id: 'save', type: 'transfer', toAccountId: 'pot', nextRunDate: inDays(7) }),
        rule({ id: 'paused', active: false }),
      ],
    });
    expect(items.map((i) => [i.key, i.title, i.sign, i.route])).toEqual([
      ['loan-car', 'Car loan EMI', '-', '/loans'],
      ['salary', 'Salary', '+', '/recurring'],
      ['stream', 'Subscriptions', '-', '/recurring'],
      ['loan-home', 'Home loan EMI', '-', '/loans'],
      ['card-card', 'Blue Card bill', '-', '/add-transaction?type=transfer&toAccountId=card&amount=642000'],
      ['save', 'Bank → Pot', '', '/recurring'],
    ]);
  });

  it('tints an EMI with the accent colour', () => {
    const { items } = buildUpcomingItems({
      ...base,
      loans: [{ id: 'l', name: 'Home loan', nextDueDate: inDays(1), nextEmiMinor: 100 }],
    });
    expect(items[0].iconColor).toBe('#8CCED6');
  });

  it(`keeps day ${UPCOMING_DAYS} and leaves day ${UPCOMING_DAYS + 1} for "next"`, () => {
    const { items, next } = buildUpcomingItems({
      ...base,
      rules: [
        rule({ id: 'edge', nextRunDate: inDays(UPCOMING_DAYS) }),
        rule({ id: 'later', nextRunDate: inDays(UPCOMING_DAYS + 1) }),
        rule({ id: 'muchLater', nextRunDate: inDays(30) }),
      ],
    });
    expect(items.map((i) => i.key)).toEqual(['edge']);
    expect(next?.key).toBe('later');
  });

  it('always lists what is overdue, first, however old', () => {
    const { items } = buildUpcomingItems({
      ...base,
      loans: [{ id: 'l', name: 'Home loan', nextDueDate: inDays(2), nextEmiMinor: 100 }],
      rules: [rule({ id: 'rent', nextRunDate: inDays(-40) })],
    });
    expect(items.map((i) => [i.key, i.urgent])).toEqual([
      ['rent', true],
      ['loan-l', false],
    ]);
  });

  it('puts the bigger amount first on the same day', () => {
    const { items } = buildUpcomingItems({
      ...base,
      rules: [
        rule({ id: 'small', amountMinor: 100, nextRunDate: inDays(3) }),
        rule({ id: 'big', amountMinor: 900, nextRunDate: inDays(3) }),
      ],
    });
    expect(items.map((i) => i.key)).toEqual(['big', 'small']);
  });

  it('skips a card bill with nothing left to pay', () => {
    const { items } = buildUpcomingItems({
      ...base,
      cardBills: [{ accountId: 'card', accountName: 'Blue Card', dueDate: inDays(2), leftToPayMinor: 0 }],
    });
    expect(items).toEqual([]);
  });

  it('a quiet week has no items but still knows what is next; no data at all has neither', () => {
    const quiet = buildUpcomingItems({
      ...base,
      loans: [{ id: 'l', name: 'Home loan', nextDueDate: inDays(11), nextEmiMinor: 100 }],
    });
    expect(quiet.items).toEqual([]);
    expect(quiet.next?.key).toBe('loan-l');
    expect(buildUpcomingItems(base)).toEqual({ items: [], next: null });
  });
});
