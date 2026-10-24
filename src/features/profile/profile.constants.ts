import { AccountType, InvestmentKind } from '@/types';

/** What the account forms offer. An investment is a savings account whose value you track, shown as its own choice. */
export type AccountChoice = AccountType | 'investment';

export const ACCOUNT_CHOICES: { label: string; value: AccountChoice }[] = [
  { label: 'Bank', value: 'bank' },
  { label: 'Cash', value: 'cash' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Savings', value: 'savings' },
  { label: 'Investment', value: 'investment' },
  { label: 'Credit card', value: 'credit_card' },
];

export const choiceOf = (type: AccountType, tracked: boolean): AccountChoice =>
  type === 'savings' && tracked ? 'investment' : type;

export const typeOfChoice = (choice: AccountChoice): AccountType =>
  choice === 'investment' ? 'savings' : choice;

export const INVESTMENT_KIND_CHOICES: { label: string; value: InvestmentKind }[] = [
  { label: 'Mutual fund', value: 'mutual_fund' },
  { label: 'Stocks', value: 'stocks' },
  { label: 'Gold', value: 'gold' },
  { label: 'Fixed deposit', value: 'fixed_deposit' },
  { label: 'PPF / EPF', value: 'ppf_epf' },
  { label: 'Other', value: 'other' },
];
