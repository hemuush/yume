import { theme } from '@/constants/theme';
import { Account } from '@/types';

/**
 * The badge colour rule for one account: a warmer, fixed tone for
 * savings/credit accounts, the user's own accent for everything else — so
 * colour means something about the account instead of just marking its
 * position in a list. Shared by the in-app `AccountChip` and the Accounts
 * home-screen widget so the two can never quietly disagree about which
 * accounts get the warm tone.
 */
export function accountBadgeColor(type: Account['type'], accent: string): string {
  return type === 'savings' || type === 'credit_card' ? theme.colors.idCoralDeep : accent;
}

const ACCOUNT_ICON: Record<Account['type'], string> = {
  bank: 'bank',
  cash: 'cash',
  wallet: 'wallet',
  credit_card: 'credit-card',
  savings: 'piggy-bank',
};

/** The icon for an account, by type — one mapping, so an account looks the same everywhere it appears. */
export function accountIcon(type: Account['type']): string {
  return ACCOUNT_ICON[type] ?? 'credit-card';
}
