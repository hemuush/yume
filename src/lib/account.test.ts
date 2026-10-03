import { savingsAccountIdsOf, spendableAccountsOf } from './account';
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
