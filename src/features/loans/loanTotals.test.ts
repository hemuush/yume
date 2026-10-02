import { summarizeLoans } from './loanTotals';
import type { Loan } from '@/types';
import type { LoanProgress } from '@/db/loans';

const loan = (over: Partial<Loan>): Loan =>
  ({
    id: 'l',
    direction: 'borrowed',
    status: 'active',
    principalMinor: 10000000,
    outstandingPrincipalMinor: 8000000,
    emiAmountMinor: 100000,
    ...over,
  }) as Loan;

const prog = (loanId: string, over: Partial<LoanProgress>): LoanProgress => ({
  loanId,
  paidCount: 1,
  totalCount: 12,
  nextDueDate: '2026-10-05',
  nextEmiMinor: 100000,
  lastDueDate: '2027-09-05',
  pendingInterestMinor: 0,
  ...over,
});

describe('summarizeLoans', () => {
  it('sums borrowed EMIs, interest and the latest debt-free date; keeps lent money apart', () => {
    const loans = [
      loan({ id: 'a', emiAmountMinor: 180700 }),
      loan({ id: 'b', emiAmountMinor: 1819700, outstandingPrincipalMinor: 5000000 }),
      loan({ id: 'c', direction: 'lent', outstandingPrincipalMinor: 300000, emiAmountMinor: 50000 }),
    ];
    const t = summarizeLoans(loans, {
      a: prog('a', { lastDueDate: '2029-04-05', pendingInterestMinor: 1146800 }),
      b: prog('b', { lastDueDate: '2045-01-07', pendingInterestMinor: 100000 }),
    });
    expect(t.emiPerMonthMinor).toBe(180700 + 1819700);
    expect(t.interestLeftMinor).toBe(1246800);
    expect(t.debtFreeDate).toBe('2045-01-07');
    expect(t.youOweMinor).toBe(8000000 + 5000000);
    expect(t.owedToYouMinor).toBe(300000);
    expect(t.activeCount).toBe(3);
  });

  it('leaves closed loans out of the totals and counts them', () => {
    const t = summarizeLoans([loan({ id: 'a' }), loan({ id: 'z', status: 'closed' })], { a: prog('a', {}) });
    expect(t.youOweMinor).toBe(8000000);
    expect(t.activeCount).toBe(1);
    expect(t.closedCount).toBe(1);
  });

  it('has no debt-free date or repaid share with nothing borrowed', () => {
    const t = summarizeLoans([loan({ id: 'c', direction: 'lent' })], {});
    expect(t.debtFreeDate).toBeNull();
    expect(t.repaidFraction).toBe(0);
  });
});
