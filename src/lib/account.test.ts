import { accountIcon, savingsAccountIdsOf, spendableAccountsOf } from './account';
import type { Account } from '@/types';

const acc = (id: string, type: Account['type']) => ({ id, type }) as Account;
const accounts = [acc('a', 'bank'), acc('b', 'savings'), acc('c', 'credit_card'), acc('d', 'cash')];

describe('account helpers', () => {
  it('spendableAccountsOf drops only savings', () => {
    expect(spendableAccountsOf(accounts).map((a) => a.id)).toEqual(['a', 'c', 'd']);
  });

  it('savingsAccountIdsOf collects just the savings ids', () => {
    expect([...savingsAccountIdsOf(accounts)]).toEqual(['b']);
  });
});

describe('accountIcon', () => {
  it('draws each kind of account, and each kind of investment, with its own picture', () => {
    expect(accountIcon('bank')).toBe('bank');
    expect(accountIcon('credit_card')).toBe('credit-card');
    expect(accountIcon('bank', true)).toBe('trending-up');
    expect(accountIcon('bank', { kind: 'gold' })).toBe('gold');
    expect(accountIcon('bank', { kind: 'mutual_fund' })).toBe('chart-areaspline');
    expect(accountIcon('savings', { kind: null })).toBe('trending-up');
    const kinds = ['mutual_fund', 'stocks', 'gold', 'fixed_deposit', 'ppf_epf'] as const;
    expect(new Set(kinds.map((kind) => accountIcon('bank', { kind }))).size).toBe(kinds.length);
  });
});
