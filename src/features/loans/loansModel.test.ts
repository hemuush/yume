import type { LoanProgress } from '@/db/loans';
import type { Loan } from '@/types';
import { buildLoansModel } from './loansModel';

const loan = (id: string, extra: Partial<Loan> = {}) =>
  ({
    id,
    counterparty: id,
    direction: 'borrowed',
    status: 'active',
    principalMinor: 100_000,
    outstandingPrincipalMinor: 60_000,
    emiAmountMinor: 10_000,
    ...extra,
  }) as Loan;
const progress = (loanId: string, lastDueDate: string | null): LoanProgress =>
  ({
    loanId,
    paidCount: 1,
    totalCount: 10,
    nextDueDate: null,
    nextEmiMinor: 10_000,
    lastDueDate,
  }) as LoanProgress;

describe('buildLoansModel', () => {
  const today = new Date(2026, 10, 15);

  it('sets closed loans apart and keeps them out of the totals', () => {
    const open = loan('open');
    const closed = loan('closed', { status: 'closed', outstandingPrincipalMinor: 0 });
    const model = buildLoansModel([open, closed], {}, today);
    expect(model.activeLoans).toEqual([open]);
    expect(model.closedLoans).toEqual([closed]);
    expect(model.totals.youOweMinor).toBe(60_000);
  });

  it('counts a defaulted loan as still owed', () => {
    const model = buildLoansModel([loan('late', { status: 'defaulted' })], {}, today);
    expect(model.activeLoans).toHaveLength(1);
    expect(model.totals.youOweMinor).toBe(60_000);
  });

  it('gives every loan a colour', () => {
    const model = buildLoansModel([loan('a'), loan('b')], {}, today);
    expect(Object.keys(model.hues).sort()).toEqual(['a', 'b']);
  });

  it('lays out a payoff timeline from the borrowed loans that have a last EMI', () => {
    const model = buildLoansModel(
      [loan('a'), loan('lent', { direction: 'lent' }), loan('noEnd')],
      { a: progress('a', '2028-11-05'), lent: progress('lent', '2027-05-05') },
      today
    );
    const ids = model.timeline?.rows.map((item) => item.id) ?? [];
    expect(ids).toEqual(['a']);
  });

  it('has no timeline when nothing is being repaid', () => {
    expect(buildLoansModel([loan('lent', { direction: 'lent' })], {}, today).timeline).toBeNull();
  });
});
