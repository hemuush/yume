/** Bounds on loan inputs: past these the EMI maths overflows or the schedule becomes unreasonably long. */
export const MAX_LOAN_RATE_BP = 10000;
export const MAX_LOAN_TENURE_MONTHS = 600;

export const RATE_TOO_HIGH_MESSAGE = 'Interest rate can be at most 100% a year';
export const TENURE_OUT_OF_RANGE_MESSAGE = `Tenure must be a whole number of months, up to ${MAX_LOAN_TENURE_MONTHS} (50 years)`;

export function rateProblem(rateBp: number): string | null {
  return rateBp > MAX_LOAN_RATE_BP ? RATE_TOO_HIGH_MESSAGE : null;
}

export function tenureProblem(tenureMonths: number): string | null {
  return !Number.isInteger(tenureMonths) || tenureMonths > MAX_LOAN_TENURE_MONTHS
    ? TENURE_OUT_OF_RANGE_MESSAGE
    : null;
}
