import type { Account } from '@/types';

/** Past this share of the limit a card is flagged: a common guide for keeping a credit score healthy. */
export const HIGH_USE_PCT = 30;

export interface CardUsage {
  limitMinor: number;
  /** What the card owes now, billed or not: a card's balance is what is in it, so negative while owed. */
  usedMinor: number;
  /** What is left to spend; negative once over the limit. */
  availableMinor: number;
  /** Share of the limit used, 0 or more (over 100 when past the limit). */
  pct: number;
  high: boolean;
}

/** How much of a credit card's limit is used, or null when it is not a card or has no limit set. */
export function cardUsage(
  account: Pick<Account, 'type' | 'creditLimitMinor' | 'currentBalanceMinor'>
): CardUsage | null {
  const limit = account.creditLimitMinor;
  if (account.type !== 'credit_card' || limit == null || limit <= 0) return null;
  const used = Math.max(0, -account.currentBalanceMinor);
  const pct = (used / limit) * 100;
  return {
    limitMinor: limit,
    usedMinor: used,
    availableMinor: limit - used,
    pct,
    high: pct > HIGH_USE_PCT,
  };
}
