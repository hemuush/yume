import type { Account, RecurringRule } from '@/types';
import { recurringRulesInCurrency } from './recurringScope';
import { subscriptionTotals } from '@/db/subscriptions';
import { buildDueItems, buildDueSoon } from '@/features/plan/planOverview';

const accounts = [
  { id: 'inr', currency: 'INR' },
  { id: 'usd', currency: 'USD' },
] as Account[];
const rules = ['inr', 'usd'].map((accountId) => ({
  id: accountId,
  accountId,
  type: 'expense',
  active: true,
  amountMinor: 10000,
  intervalCount: 1,
  frequency: 'monthly',
  nextRunDate: '2026-10-20',
})) as RecurringRule[];

it('scopes subscription and Plan totals without treating USD cents as INR paise', () => {
  const scoped = recurringRulesInCurrency(rules, accounts, 'INR');
  expect(scoped.map((r) => r.id)).toEqual(['inr']);
  expect(subscriptionTotals(scoped)).toEqual({ monthlyMinor: 10000, yearlyMinor: 120000, count: 1 });
  expect(
    buildDueSoon(
      buildDueItems(
        [],
        scoped.map((r) => ({ ...r, label: r.id }))
      ),
      '2026-10-19'
    ).totalMinor
  ).toBe(10000);
  expect(recurringRulesInCurrency(rules, accounts, 'USD').map((r) => r.id)).toEqual(['usd']);
});

it('excludes unknown accounts and legacy transfers whose destination is a different currency', () => {
  const other = [
    { ...rules[0], id: 'missing', accountId: 'missing' },
    { ...rules[0], id: 'transfer', type: 'transfer' as const, toAccountId: 'usd' },
  ];
  expect(recurringRulesInCurrency(other, accounts, 'INR')).toEqual([]);
});
