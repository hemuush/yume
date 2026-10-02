import { LoanPayment } from '@/types';
import { parseLocalIsoDate } from './date';

export interface LoanPayoff {
  /** The last EMI still to pay, YYYY-MM-DD — when the loan is done. Null once nothing is pending. */
  lastDueDate: string | null;
  emisLeft: number;
  /** Interest in the EMIs still to pay. */
  interestLeftMinor: number;
  /** What's owed now, then after each EMI still to pay — ends at (about) zero. */
  balances: number[];
}

/**
 * When a loan will be paid off and what it still costs, from its own
 * schedule — so a prepayment or a rate change (which rewrite the schedule)
 * show up here straight away.
 */
export function loanPayoff(schedule: LoanPayment[], outstandingMinor: number): LoanPayoff {
  const pending = schedule
    .filter((p) => p.status === 'pending')
    .sort((a, b) => a.installmentNumber - b.installmentNumber);
  return {
    lastDueDate: pending.length > 0 ? pending[pending.length - 1].dueDate : null,
    emisLeft: pending.length,
    interestLeftMinor: pending.reduce((sum, p) => sum + p.interestComponentMinor, 0),
    balances: [outstandingMinor, ...pending.map((p) => p.outstandingAfterMinor)],
  };
}

/** "January 2045" — the month a loan is paid off. */
export function payoffMonth(lastDueDate: string): string {
  return parseLocalIsoDate(lastDueDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * An SVG path for the balance falling over time, fitted to `width` ×
 * `height` — at most `maxPoints` points, so a 20-year loan draws as smoothly
 * (and as cheaply) as a 2-year one. Empty when there's nothing to draw.
 */
export function balanceLinePath(balances: number[], width: number, height: number, maxPoints = 48): string {
  if (balances.length < 2) return '';
  const step = Math.max(1, Math.ceil(balances.length / maxPoints));
  const picked = balances.filter((_, i) => i % step === 0);
  if (picked[picked.length - 1] !== balances[balances.length - 1]) picked.push(balances[balances.length - 1]);
  const top = Math.max(1, balances[0], ...picked);
  return picked
    .map((b, i) => {
      const x = (i / (picked.length - 1)) * width;
      const y = height - (Math.max(0, b) / top) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** "Jan 2045" — the short form of payoffMonth, for a tight card caption. */
export function payoffMonthShort(lastDueDate: string): string {
  return parseLocalIsoDate(lastDueDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
