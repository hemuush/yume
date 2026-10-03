import { LoanPayment } from '@/types';
import { newId } from './id';
import { addMonthsToIsoDate } from './date';

/** Monthly rate as a fraction, from annual rate in basis points (e.g. 950 = 9.50%). */
export function monthlyRateFromAnnualBp(annualRateBp: number): number {
  return annualRateBp / 10000 / 12;
}

/**
 * Fraction (0-1) of principal repaid, `(principal − outstanding) / principal`, clamped against bad inputs.
 * Principal-based, not installment-based (early installments are interest-heavy); needs only a `Loan` row.
 */
export function payoffFraction(principalMinor: number, outstandingPrincipalMinor: number): number {
  if (!Number.isFinite(principalMinor) || principalMinor <= 0) return 0;
  const paid = principalMinor - outstandingPrincipalMinor;
  return Math.max(0, Math.min(1, paid / principalMinor));
}

/**
 * Reducing-balance EMI: P * r * (1+r)^n / ((1+r)^n - 1).
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
 * Schedule for the remaining tenure after a prepayment (EMI fixed, tenure shrinks), from a given installment.
 * `fromDate` is `anchorInstallmentNumber`'s due date; all dates offset from it so a 31st due day never drifts.
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
   * If set, this installment closes the loan exactly (principal = all that's left), absorbing rounding
   * residue (keepTenure). Omitted, the schedule runs until the balance reaches zero.
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
