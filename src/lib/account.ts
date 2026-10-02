import { theme } from '@/constants/theme';
import { Account } from '@/types';

/**
 * The badge colour rule for one account: a warmer, fixed tone for
 * savings/credit accounts, the user's own accent for everything else — so
 * colour means something about the account instead of just marking its
 * position in a list. Shared by Home's account cards and the Accounts
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

/** The ids of the savings accounts — what "hide savings & investment amounts" masks transfers by. */
export function savingsAccountIdsOf(accounts: Account[]): Set<string> {
  return new Set(accounts.filter((a) => a.type === 'savings').map((a) => a.id));
}

/** The colour family an account is tinted in, by type — its Home card and its summary sheet alike. */
export function accountHue(type: Account['type'], accent: string): string {
  switch (type) {
    case 'cash':
      return theme.colors.flatLime;
    case 'wallet':
      return theme.colors.secondary;
    case 'credit_card':
      return theme.colors.idGoldDeep;
    case 'savings':
      return theme.colors.idCoralDeep;
    default:
      return accent;
  }
}
