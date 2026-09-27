import { loanPayoff, balanceLinePath, payoffMonth } from './loanPayoff';
import { LoanPayment } from '@/types';

const payment = (n: number, status: LoanPayment['status'], interest: number, after: number): LoanPayment => ({
  id: `p${n}`,
  loanId: 'l1',
  transactionId: null,
  installmentNumber: n,
  dueDate: `2026-${String(n).padStart(2, '0')}-05`,
  paidDate: null,
  emiAmountMinor: 10000,
  principalComponentMinor: 10000 - interest,
  interestComponentMinor: interest,
  outstandingAfterMinor: after,
  status,
});

describe('loanPayoff', () => {
  const schedule = [
    payment(3, 'pending', 300, 18000),
    payment(1, 'paid', 500, 36000),
    payment(4, 'pending', 200, 8200),
    payment(2, 'paid', 400, 27000),
    payment(5, 'pending', 100, 0),
  ];

  it('finds the last EMI, how many are left and the interest in them', () => {
    expect(loanPayoff(schedule, 27000)).toEqual({
      lastDueDate: '2026-05-05',
      emisLeft: 3,
      interestLeftMinor: 600,
      balances: [27000, 18000, 8200, 0],
    });
  });

  it('has nothing left once every EMI is paid', () => {
    const done = schedule.map((p) => ({ ...p, status: 'paid' as const }));
    expect(loanPayoff(done, 0)).toEqual({
      lastDueDate: null,
      emisLeft: 0,
      interestLeftMinor: 0,
      balances: [0],
    });
  });
});

describe('balanceLinePath', () => {
  it('draws from the top-left down to zero on the right', () => {
    expect(balanceLinePath([100, 50, 0], 200, 40)).toBe('M0.0,0.0 L100.0,20.0 L200.0,40.0');
  });

  it('thins a long schedule to a handful of points, keeping the last', () => {
    const balances = Array.from({ length: 241 }, (_, i) => 240 - i);
    const path = balanceLinePath(balances, 100, 10, 48);
    expect(path.split(' ').length).toBeLessThanOrEqual(50);
    expect(path.endsWith('L100.0,10.0')).toBe(true);
  });

  it('draws nothing without at least two points', () => {
    expect(balanceLinePath([0], 100, 10)).toBe('');
  });
});

describe('payoffMonth', () => {
  it('names the month and year', () => {
    expect(payoffMonth('2045-01-05')).toMatch(/2045/);
  });
});
