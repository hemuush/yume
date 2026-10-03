import type { TrackedBalanceParts } from '@/db/reports';
import { roundedMinor } from '@/lib/round';

export interface TrackedSumLines {
  totalMinor: number;
  accountsMinor: number;
  loansMinor: number;
  peopleMinor: number;
}

/**
 * Tracked balance as Profile shows it: whole-rupee lines whose total adds up on screen. Accounts is
 * `accountsShownMinor` (sum of shown rows); loans/people round once; total sums the shown lines.
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
 * Accounts grouped by type (bank, cash, wallet, credit card, savings) with a whole-rupee subtotal each,
 * default-currency only like the accounts total, so subtotals add up. Fixed group order, savings last.
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
