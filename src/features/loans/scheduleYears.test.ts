import { groupScheduleByYear, currentScheduleYear } from './scheduleYears';
import type { LoanPayment } from '@/types';

const pay = (n: number, dueDate: string, status: LoanPayment['status']): LoanPayment => ({
  id: `p${n}`,
  loanId: 'l',
  transactionId: null,
  installmentNumber: n,
  dueDate,
  paidDate: null,
  emiAmountMinor: 100000,
  principalComponentMinor: 80000,
  interestComponentMinor: 20000,
  outstandingAfterMinor: 0,
  status,
});

describe('groupScheduleByYear', () => {
  const schedule = [
    pay(3, '2027-01-05', 'pending'),
    pay(1, '2026-11-05', 'paid'),
    pay(2, '2026-12-05', 'paid'),
    pay(4, '2027-02-05', 'pending'),
  ];

  it('groups EMIs by due year in order and counts the paid ones', () => {
    const years = groupScheduleByYear(schedule);
    expect(years.map((y) => y.year)).toEqual([2026, 2027]);
    expect(years[0].payments.map((p) => p.installmentNumber)).toEqual([1, 2]);
    expect(years[0].paidCount).toBe(2);
    expect(years[1].paidCount).toBe(0);
  });

  it("opens on the next EMI's year", () => {
    expect(currentScheduleYear(groupScheduleByYear(schedule))).toBe(2027);
  });

  it('opens on the last year once nothing is pending, and on nothing for an empty schedule', () => {
    expect(currentScheduleYear(groupScheduleByYear([pay(1, '2026-11-05', 'paid')]))).toBe(2026);
    expect(currentScheduleYear([])).toBeNull();
  });
});
