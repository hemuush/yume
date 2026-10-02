import type { LoanPayment } from '@/types';

export interface ScheduleYear {
  year: number;
  payments: LoanPayment[];
  paidCount: number;
}

/** The schedule split by the calendar year each EMI falls due, in order. */
export function groupScheduleByYear(schedule: LoanPayment[]): ScheduleYear[] {
  const years = new Map<number, ScheduleYear>();
  for (const p of [...schedule].sort((a, b) => a.installmentNumber - b.installmentNumber)) {
    const year = Number(p.dueDate.slice(0, 4));
    const group = years.get(year) ?? { year, payments: [], paidCount: 0 };
    group.payments.push(p);
    if (p.status === 'paid') group.paidCount += 1;
    years.set(year, group);
  }
  return [...years.values()].sort((a, b) => a.year - b.year);
}

/** The year the schedule opens on: the next EMI's, or the last year once everything is paid. */
export function currentScheduleYear(years: ScheduleYear[]): number | null {
  const next = years.find((y) => y.payments.some((p) => p.status === 'pending'));
  return next ? next.year : years.length > 0 ? years[years.length - 1].year : null;
}
