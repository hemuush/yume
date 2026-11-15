import type { LoanProgress } from '@/db/loans';
import type { Loan } from '@/types';
import { loanHues } from './loanIdentity';
import { debtShares, summarizeLoans } from './loanTotals';
import { buildTimeline } from './timelineLayout';

/**
 * What the Loans page shows, worked out from the loans and each one's progress. A defaulted loan is still money owed (or
 * owed to you), so only closed loans drop out of the totals; closed ones also sit apart in the list.
 */
export function buildLoansModel(loans: Loan[], progress: Record<string, LoanProgress>, today: Date) {
  const activeLoans = loans.filter((l) => l.status !== 'closed');
  const closedLoans = loans.filter((l) => l.status === 'closed');
  return {
    activeLoans,
    closedLoans,
    hues: loanHues(loans),
    totals: summarizeLoans(loans, progress),
    shares: debtShares(loans),
    timeline: buildTimeline(
      activeLoans.flatMap((l) => {
        const end = progress[l.id]?.lastDueDate;
        return l.direction === 'borrowed' && end ? [{ id: l.id, name: l.counterparty, endDate: end }] : [];
      }),
      today
    ),
  };
}
