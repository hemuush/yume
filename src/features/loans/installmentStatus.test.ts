import { isOverdueInstallment, isUnpaidInstallment, nextUnpaidInstallment } from './installmentStatus';
import type { LoanPayment } from '@/types';

const p = (n: number, dueDate: string, status: LoanPayment['status'] = 'pending'): LoanPayment =>
  ({ id: `i${n}`, installmentNumber: n, dueDate, status }) as LoanPayment;

describe('installment status', () => {
  it('calls an unpaid EMI due before today overdue, though the database keeps it pending', () => {
    expect(isOverdueInstallment(p(1, '2026-09-01'), '2026-10-04')).toBe(true);
    expect(isOverdueInstallment(p(1, '2026-10-04'), '2026-10-04')).toBe(false);
    expect(isOverdueInstallment(p(1, '2026-09-01', 'paid'), '2026-10-04')).toBe(false);
  });

  it('treats pending and overdue as unpaid', () => {
    expect(isUnpaidInstallment(p(1, '2026-09-01', 'overdue'))).toBe(true);
    expect(isUnpaidInstallment(p(1, '2026-09-01', 'prepaid'))).toBe(false);
  });

  it('picks the lowest-numbered unpaid EMI as next, even when it is past due', () => {
    const schedule = [p(3, '2026-12-01'), p(1, '2026-09-01', 'paid'), p(2, '2026-09-15'), p(4, '2027-01-01')];
    expect(nextUnpaidInstallment(schedule)?.id).toBe('i2');
    expect(nextUnpaidInstallment([p(1, '2026-09-01', 'paid')])).toBeUndefined();
  });
});
