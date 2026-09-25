import { LoanPayment } from '@/types';
import { newId } from './id';
import { addMonthsToIsoDate } from './date';

/** Monthly rate as a fraction, from annual rate in basis points (e.g. 950 = 9.50%). */
export function monthlyRateFromAnnualBp(annualRateBp: number): number {
  return annualRateBp / 10000 / 12;
}

/**
 * How much of a loan's principal has actually been repaid, as a 0-1
 * fraction — `(principal − outstanding) / principal`, clamped so a rounding
 * edge case or a bad input can never render a negative or over-100% bar.
 * Principal-based rather than installment-count-based on purpose: a
 * reducing-balance loan's early installments are interest-heavy, so
 * "42 of 60 installments paid" (70%) and "42/60ths of the principal repaid"
 * are genuinely different numbers — this is the one that reflects real money
 * moved, and the only one computable from a `Loan` row alone with no extra
 * schedule query.
 */
export function payoffFraction(principalMinor: number, outstandingPrincipalMinor: number): number {
  if (!Number.isFinite(principalMinor) || principalMinor <= 0) return 0;
  const paid = principalMinor - outstandingPrincipalMinor;
  return Math.max(0, Math.min(1, paid / principalMinor));
}

/**
 * Standard reducing-balance EMI formula:
 *   EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * Falls back to a straight-line split when r = 0 (interest-free loan).
 */
export function calculateEmi(principalMinor: number, annualRateBp: number, tenureMonths: number): number {
  const r = monthlyRateFromAnnualBp(annualRateBp);
  if (tenureMonths <= 0) return 0;
  if (r === 0) return Math.round(principalMinor / tenureMonths);

  const factor = Math.pow(1 + r, tenureMonths);
  const emi = (principalMinor * r * factor) / (factor - 1);
  return Math.round(emi);
}

/**
 * Full amortization schedule for a loan, starting from installment 1.
 * The last installment absorbs any rounding residue so outstanding hits exactly 0.
 */
export function generateAmortizationSchedule(params: {
  loanId: string;
  principalMinor: number;
  annualRateBp: number;
  tenureMonths: number;
  startDate: string; // ISO date of first EMI due date
  emiAmountMinor?: number; // override, e.g. after a prepayment recalculation
}): Omit<LoanPayment, 'transactionId' | 'paidDate' | 'status'>[] {
  const { loanId, principalMinor, annualRateBp, tenureMonths, startDate } = params;
  const r = monthlyRateFromAnnualBp(annualRateBp);
  const emi = params.emiAmountMinor ?? calculateEmi(principalMinor, annualRateBp, tenureMonths);

  const schedule: Omit<LoanPayment, 'transactionId' | 'paidDate' | 'status'>[] = [];
  let outstanding = principalMinor;

  for (let i = 1; i <= tenureMonths; i++) {
    const interestComponent = Math.round(outstanding * r);
    let principalComponent = emi - interestComponent;
    let installmentEmi = emi;

    if (i === tenureMonths || principalComponent >= outstanding) {
      // Last installment (or an over-shoot from rounding drift): close out exactly.
      principalComponent = outstanding;
      installmentEmi = principalComponent + interestComponent;
    }

    outstanding -= principalComponent;
    if (outstanding < 0) outstanding = 0;

    schedule.push({
      id: newId(),
      loanId,
      installmentNumber: i,
      dueDate: addMonthsToIsoDate(startDate, i - 1),
      emiAmountMinor: installmentEmi,
      principalComponentMinor: principalComponent,
      interestComponentMinor: interestComponent,
      outstandingAfterMinor: outstanding,
    });

    if (outstanding === 0) break;
  }

  return schedule;
}

/**
 * Recompute a fresh schedule for the remaining tenure after a prepayment,
 * keeping EMI fixed and reducing tenure. Returns the new schedule starting
 * from the given installment number.
 *
 * `fromDate` is the due date of installment `anchorInstallmentNumber`
 * (defaults to `fromInstallmentNumber`, i.e. the first regenerated one), and
 * every due date is offset from it rather than chained installment to
 * installment. Callers pass installment #1's own due date with
 * `anchorInstallmentNumber: 1` — the same anchor generateAmortizationSchedule
 * uses — so a loan due on the 31st keeps landing on the 31st (or the month's
 * last day) after a prepayment or rate change, instead of inheriting
 * whatever clamped day the next pending installment happened to fall on.
 */
export function recalculateAfterPrepayment(params: {
  loanId: string;
  outstandingPrincipalMinor: number;
  annualRateBp: number;
  emiAmountMinor: number;
  fromInstallmentNumber: number;
  fromDate: string;
  anchorInstallmentNumber?: number;
  /**
   * If set, this installment closes the loan out exactly (principal = all
   * that's left), absorbing rounding residue — for a schedule that must end
   * on a fixed installment (keepTenure). Omitted, the schedule runs until
   * the balance reaches zero on its own.
   */
  lastInstallmentNumber?: number;
}): Omit<LoanPayment, 'transactionId' | 'paidDate' | 'status'>[] {
  const { loanId, outstandingPrincipalMinor, annualRateBp, emiAmountMinor, fromInstallmentNumber, fromDate } =
    params;
  const anchorInstallmentNumber = params.anchorInstallmentNumber ?? fromInstallmentNumber;
  const r = monthlyRateFromAnnualBp(annualRateBp);
  const schedule: Omit<LoanPayment, 'transactionId' | 'paidDate' | 'status'>[] = [];
  let outstanding = outstandingPrincipalMinor;
  let i = fromInstallmentNumber;

  // Cap iterations defensively — a too-small EMI relative to interest would
  // otherwise never amortize and loop indefinitely.
  const maxIterations = 1200;
  let iterations = 0;

  while (outstanding > 0 && iterations < maxIterations) {
    const interestComponent = Math.round(outstanding * r);
    let principalComponent = emiAmountMinor - interestComponent;
    let installmentEmi = emiAmountMinor;

    if (principalComponent <= 0) {
      // EMI doesn't even cover interest — cannot amortize with this EMI.
      break;
    }

    if (principalComponent >= outstanding || i === params.lastInstallmentNumber) {
      principalComponent = outstanding;
      installmentEmi = principalComponent + interestComponent;
    }

    outstanding -= principalComponent;

    schedule.push({
      id: newId(),
      loanId,
      installmentNumber: i,
      dueDate: addMonthsToIsoDate(fromDate, i - anchorInstallmentNumber),
      emiAmountMinor: installmentEmi,
      principalComponentMinor: principalComponent,
      interestComponentMinor: interestComponent,
      outstandingAfterMinor: outstanding,
    });

    i++;
    iterations++;
  }

  return schedule;
}
