/**
 * Home's Upcoming list: the next EMI and every active recurring rule,
 * soonest first, each pointing where it lives.
 */
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { buildUpcomingItems } from './HomeGlance';
import { RecurringRule } from '@/types';

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
  nextRunDate: '2999-01-10',
  endDate: null,
  active: true,
  ...over,
});

describe('buildUpcomingItems', () => {
  const items = buildUpcomingItems({
    nextDue: {
      loanId: 'l',
      counterparty: 'Home loan',
      dueDate: '2999-01-05',
      emiAmountMinor: 1800000,
    } as any,
    rules: [
      rule({ id: 'stream' }),
      rule({ id: 'salary', type: 'income', nextRunDate: '2999-01-01', note: 'Salary' }),
      rule({ id: 'save', type: 'transfer', toAccountId: 'pot', nextRunDate: '2999-01-20' }),
      rule({ id: 'paused', active: false }),
    ],
    accent: '#8CCED6',
    accountName: (id) => ({ bank: 'Bank', pot: 'Pot' })[id ?? ''],
    categoryName: (id) => (id === 'subs' ? 'Subscriptions' : undefined),
  });

  it('merges the EMI and active rules, soonest first, leaving paused rules out', () => {
    expect(items.map((i) => [i.key, i.title, i.sign, i.route])).toEqual([
      ['salary', 'Salary', '+', '/recurring'],
      ['loan', 'Home loan EMI', '-', '/loans'],
      ['stream', 'Subscriptions', '-', '/recurring'],
      ['save', 'Bank → Pot', '', '/recurring'],
    ]);
  });

  it('tints the EMI with the accent colour', () => {
    expect(items.find((i) => i.key === 'loan')?.iconColor).toBe('#8CCED6');
  });
});
