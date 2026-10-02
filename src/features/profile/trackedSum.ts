import type { TrackedBalanceParts } from '@/db/reports';
import { roundedMinor } from '@/lib/round';

export interface TrackedSumLines {
  totalMinor: number;
  accountsMinor: number;
  loansMinor: number;
  peopleMinor: number;
}

/**
 * The tracked balance as Profile shows it — three lines and their total —
 * in whole rupees that add up on screen. The accounts line is
 * `accountsShownMinor` (the sum of the account rows as displayed, so it
 * matches the Accounts card), loans and people are each rounded once, and
 * the total is built from those shown lines rather than rounded separately,
 * so the sum on screen always holds (see roundedMinor).
 */
export function trackedSumLines(parts: TrackedBalanceParts, accountsShownMinor: number): TrackedSumLines {
  const loansMinor = roundedMinor(parts.loansMinor);
  const peopleMinor = roundedMinor(parts.peopleMinor);
  return {
    totalMinor: accountsShownMinor + loansMinor + peopleMinor,
    accountsMinor: accountsShownMinor,
    loansMinor,
    peopleMinor,
  };
}

export interface AccountGroup<T> {
  type: string;
  accounts: T[];
  /** Whole-rupee sum of the group's default-currency accounts; null when it has none. */
  subtotalMinor: number | null;
}

const GROUP_ORDER = ['bank', 'cash', 'wallet', 'credit_card', 'savings'];

/**
 * Accounts gathered by type (bank, cash, wallet, credit card, savings) with
 * the whole-rupee subtotal of each, counting only default-currency accounts
 * like the accounts total does, so the subtotals add up to that total.
 * Groups are in a fixed order, savings last; accounts keep their own order.
 */
export function groupAccountsByType<
  T extends { type: string; currency: string; currentBalanceMinor: number },
>(accounts: T[], defaultCurrency: string): AccountGroup<T>[] {
  const types = [...new Set(accounts.map((a) => a.type))].sort((a, b) => rank(a) - rank(b));
  return types.map((type) => {
    const members = accounts.filter((a) => a.type === type);
    const counted = members.filter((a) => a.currency === defaultCurrency);
    return {
      type,
      accounts: members,
      subtotalMinor:
        counted.length === 0 ? null : counted.reduce((s, a) => s + roundedMinor(a.currentBalanceMinor), 0),
    };
  });
}

function rank(type: string): number {
  const i = GROUP_ORDER.indexOf(type);
  return i === -1 ? GROUP_ORDER.length : i;
}
