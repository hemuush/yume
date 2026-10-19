import type { Account, RecurringRule } from '@/types';

/** Default-currency summaries never convert or add money from other denominations. */
export function recurringRulesInCurrency(
  rules: RecurringRule[],
  accounts: Account[],
  currency: string
): RecurringRule[] {
  const ids = new Set(accounts.filter((a) => a.currency === currency).map((a) => a.id));
  return rules.filter(
    (r) => ids.has(r.accountId) && (r.type !== 'transfer' || (!!r.toAccountId && ids.has(r.toAccountId)))
  );
}
