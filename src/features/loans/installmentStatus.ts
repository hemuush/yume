import type { LoanPayment } from '@/types';

/**
 * The database only ever stores 'pending' for an unpaid EMI (nothing sets 'overdue'), so "overdue" is worked
 * out here from the due date. A stored 'overdue' is still honoured in case it is ever written.
 */
export function isUnpaidInstallment(p: Pick<LoanPayment, 'status'>): boolean {
  return p.status === 'pending' || p.status === 'overdue';
}

/** Unpaid and due before `todayIso` (local YYYY-MM-DD). */
export function isOverdueInstallment(p: Pick<LoanPayment, 'status' | 'dueDate'>, todayIso: string): boolean {
  return isUnpaidInstallment(p) && p.dueDate < todayIso;
}

/** The lowest-numbered unpaid EMI, whether or not it is overdue yet: the one to pay next. */
export function nextUnpaidInstallment(schedule: LoanPayment[]): LoanPayment | undefined {
  return schedule
    .filter(isUnpaidInstallment)
    .reduce<LoanPayment | undefined>(
      (best, p) => (!best || p.installmentNumber < best.installmentNumber ? p : best),
      undefined
    );
}
