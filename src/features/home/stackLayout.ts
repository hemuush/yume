import type { Account } from '@/types';

/** Sizes of Home's account stack: each card is 84 tall and the one in front of it leaves a 44 strip showing. */
export const STACK = {
  cardHeight: 84,
  peek: 44,
} as const;

/** Height of a stack of `n` cards: a strip for every card but the front one, which shows in full. */
export function stackHeight(n: number): number {
  return Math.max(0, n - 1) * STACK.peek + STACK.cardHeight;
}

/** Back to front: savings, then banks, then cards, wallets and cash. */
const KIND_ORDER: Record<Account['type'], number> = {
  savings: 0,
  bank: 1,
  credit_card: 2,
  wallet: 3,
  cash: 4,
};

/**
 * The accounts in the order the stack draws them, back card first and the
 * front card last. Savings sits at the back, cash in front; accounts of one
 * kind keep the order they came in.
 */
export function stackOrder(accounts: Account[]): Account[] {
  return accounts
    .map((account, index) => ({ account, index }))
    .sort((a, b) => KIND_ORDER[a.account.type] - KIND_ORDER[b.account.type] || a.index - b.index)
    .map((entry) => entry.account);
}
