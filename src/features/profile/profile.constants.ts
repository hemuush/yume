import { AccountType } from '@/types';

export const ACCOUNT_TYPES: { label: string; value: AccountType }[] = [
  { label: 'Bank', value: 'bank' },
  { label: 'Cash', value: 'cash' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Savings', value: 'savings' },
  { label: 'Credit Card', value: 'credit_card' },
];
