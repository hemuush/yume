import { roundedMinor } from '@/lib/round';
import { payoffFraction } from '@/lib/loan';
import type { LoanProgress } from '@/db/loans';
import type { Loan } from '@/types';

export interface LoanTotals {
  /** Still owed, summed from the whole-rupee figures each card shows. */
  youOweMinor: number;
  owedToYouMinor: number;
  /** What the borrowed loans' EMIs add up to each month. */
  emiPerMonthMinor: number;
  /** Interest still inside the borrowed loans' unpaid EMIs. */
  interestLeftMinor: number;
  /** The last EMI of the borrowed loans: when you're debt-free. */
  debtFreeDate: string | null;
  /** 0–1: share of the borrowed principal already repaid. */
  repaidFraction: number;
  activeCount: number;
  closedCount: number;
}

/** The numbers on the Loans hero. A defaulted loan is still owed, so only closed loans drop out. */
export function summarizeLoans(
  loans: Loan[],
  progress: Record<string, LoanProgress | undefined>
): LoanTotals {
  const active = loans.filter((l) => l.status !== 'closed');
  const borrowed = active.filter((l) => l.direction === 'borrowed');
  const sum = (list: Loan[], pick: (l: Loan) => number) => list.reduce((acc, l) => acc + pick(l), 0);
  const principal = sum(borrowed, (l) => l.principalMinor);
  const outstanding = sum(borrowed, (l) => l.outstandingPrincipalMinor);
  const ends = borrowed.map((l) => progress[l.id]?.lastDueDate).filter((d): d is string => !!d);
  return {
    youOweMinor: sum(borrowed, (l) => roundedMinor(l.outstandingPrincipalMinor)),
    owedToYouMinor: sum(
      active.filter((l) => l.direction === 'lent'),
      (l) => roundedMinor(l.outstandingPrincipalMinor)
    ),
    emiPerMonthMinor: sum(borrowed, (l) => l.emiAmountMinor),
    interestLeftMinor: sum(borrowed, (l) => progress[l.id]?.pendingInterestMinor ?? 0),
    debtFreeDate: ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : null,
    repaidFraction: principal > 0 ? payoffFraction(principal, outstanding) : 0,
    activeCount: active.length,
    closedCount: loans.length - active.length,
  };
}

export interface DebtShare {
  id: string;
  /** 0–1: this loan's part of everything still owed. */
  fraction: number;
}

/** How what you owe splits across the open borrowed loans, largest first, for the hero's share bar. */
export function debtShares(loans: Loan[]): DebtShare[] {
  const open = loans
    .filter((l) => l.status !== 'closed' && l.direction === 'borrowed')
    .map((l) => ({ id: l.id, minor: roundedMinor(l.outstandingPrincipalMinor) }))
    .filter((l) => l.minor > 0);
  const total = open.reduce((acc, l) => acc + l.minor, 0);
  if (total <= 0) return [];
  return open.sort((a, b) => b.minor - a.minor).map((l) => ({ id: l.id, fraction: l.minor / total }));
}
