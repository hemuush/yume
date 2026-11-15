import type { Loan } from '@/types';
import { createLoansSheets } from './loansSheetsStore';

const loan = (id: string) => ({ id }) as Loan;

describe('the Loans page sheets', () => {
  it('starts with everything closed', () => {
    expect(createLoansSheets().get()).toEqual({ adding: false, loan: null, payOnOpen: false });
  });

  it('opens a loan on its detail, or on its pay sheet from the Pay pill', () => {
    const sheets = createLoansSheets();
    sheets.openLoan(loan('a'));
    expect(sheets.get()).toMatchObject({ loan: { id: 'a' }, payOnOpen: false });
    sheets.payLoan(loan('b'));
    expect(sheets.get()).toMatchObject({ loan: { id: 'b' }, payOnOpen: true });
  });

  it('closing a loan also forgets that it was to open on its pay sheet', () => {
    const sheets = createLoansSheets();
    sheets.payLoan(loan('a'));
    sheets.closeLoan();
    sheets.openLoan(loan('a'));
    expect(sheets.get().payOnOpen).toBe(false);
  });

  it('shows a requested loan (null puts it away) with or without its pay sheet', () => {
    const sheets = createLoansSheets();
    sheets.show(loan('a'), true);
    expect(sheets.get()).toMatchObject({ loan: { id: 'a' }, payOnOpen: true });
    sheets.show(null);
    expect(sheets.get()).toMatchObject({ loan: null, payOnOpen: false });
  });

  it('opens and closes the new-loan form on its own, leaving a loan open', () => {
    const sheets = createLoansSheets();
    sheets.openLoan(loan('a'));
    sheets.openAdd();
    expect(sheets.get()).toMatchObject({ adding: true, loan: { id: 'a' } });
    sheets.closeAdd();
    expect(sheets.get().adding).toBe(false);
  });
});
