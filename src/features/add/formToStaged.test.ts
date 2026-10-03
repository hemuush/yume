/**
 * The Add form's checks in the order it asks (amount, person/account, category, same-currency transfer
 * destination), then the staged entry it builds.
 */
import { formToStaged, AddForm } from './addEntry';
import { Account, Category } from '@/types';

const accounts = [
  { id: 'bank', name: 'Bank', currency: 'INR' },
  { id: 'cash', name: 'Cash', currency: 'INR' },
  { id: 'usd', name: 'US card', currency: 'USD' },
] as Account[];
const categories = [{ id: 'food', name: 'Food', icon: 'food', color: '#FF9E7D' }] as Category[];
const people = [{ id: 'asha', name: 'Asha' }];
const lookups = { accounts, categories, people };

const form = (over: Partial<AddForm> = {}): AddForm => ({
  type: 'expense',
  amountMinor: 25000,
  date: '2026-09-27',
  note: '',
  accountId: 'bank',
  toAccountId: null,
  categoryId: 'food',
  personId: null,
  friendSign: 1,
  friendAccountId: null,
  ...over,
});
const error = (over: Partial<AddForm>) => {
  const r = formToStaged(form(over), lookups, 'id');
  return 'error' in r ? r.error : null;
};

describe('formToStaged', () => {
  it('asks for what is missing, in the order the form asks', () => {
    expect(error({ amountMinor: 0 })).toBe('Enter a valid amount');
    expect(error({ accountId: null })).toBe('Pick an account');
    expect(error({ categoryId: null })).toBe('Pick a category');
    expect(error({ type: 'friend', personId: null })).toBe('Pick a person');
  });

  it('needs a transfer to go somewhere else, in the same currency', () => {
    expect(error({ type: 'transfer', toAccountId: null })).toBe('Pick a different destination account');
    expect(error({ type: 'transfer', toAccountId: 'bank' })).toBe('Pick a different destination account');
    expect(error({ type: 'transfer', toAccountId: 'usd' })).toBe(
      'These accounts use different currencies (INR and USD)'
    );
    expect(error({ type: 'transfer', toAccountId: 'cash', categoryId: null })).toBeNull();
  });

  it('builds an expense with its category, and a transfer without one', () => {
    expect(formToStaged(form(), lookups, 'id')).toEqual({
      row: expect.objectContaining({
        kind: 'transaction',
        categoryId: 'food',
        label: 'Food',
        amountMinor: 25000,
      }),
    });
    expect(formToStaged(form({ type: 'transfer', toAccountId: 'cash' }), lookups, 'id')).toEqual({
      row: expect.objectContaining({ categoryId: null, toAccountId: 'cash', label: 'Transfer' }),
    });
  });

  it('builds a friend entry, with or without money moving', () => {
    expect(formToStaged(form({ type: 'friend', personId: 'asha', friendSign: -1 }), lookups, 'id')).toEqual({
      row: expect.objectContaining({
        kind: 'friend',
        personName: 'Asha',
        sign: -1,
        accountId: null,
        accountName: null,
      }),
    });
    expect(
      formToStaged(form({ type: 'friend', personId: 'asha', friendAccountId: 'cash' }), lookups, 'id')
    ).toEqual({ row: expect.objectContaining({ accountName: 'Cash' }) });
  });
});
