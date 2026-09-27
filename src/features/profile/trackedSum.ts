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
