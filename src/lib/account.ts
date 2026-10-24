import { INVESTMENT_KIND_LABEL } from './investment';
import { theme } from '@/constants/theme';
import { Account } from '@/types';
import { getCachedCurrency } from '@/db/settings';

/** Account choices for workflows whose amounts are denominated in the default currency. */
export function defaultCurrencyAccountsOf(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.currency === getCachedCurrency());
}

/**
 * Badge colour rule for one account: a fixed warm tone for savings/credit, the user's accent otherwise.
 * Shared by Home's account cards and the Accounts widget so they never disagree on which get the warm tone.
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
/** "bank", "credit card", "savings · tracked": what kind of account it is, in words. */
export function accountTypeLabel(account: Pick<Account, 'type' | 'investment'>): string {
  if (!account.investment) return account.type.replace(/_/g, ' ');
  return account.investment.kind
    ? `investment · ${INVESTMENT_KIND_LABEL[account.investment.kind].toLowerCase()}`
    : 'investment';
}

export function accountIcon(type: Account['type'], investment = false): string {
  return investment ? 'trending-up' : (ACCOUNT_ICON[type] ?? 'credit-card');
}

/** The ids of the savings accounts — what "hide savings & investment amounts" masks transfers by. */
export function savingsAccountIdsOf(accounts: Account[]): Set<string> {
  return new Set(accounts.filter((a) => a.type === 'savings').map((a) => a.id));
}

/** The accounts day-to-day spending and EMIs can come out of — savings are only reached by a transfer. */
export function spendableAccountsOf(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.type !== 'savings');
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
