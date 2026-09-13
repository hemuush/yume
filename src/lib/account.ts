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
