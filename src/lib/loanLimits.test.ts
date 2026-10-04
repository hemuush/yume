import { calculateEmi } from './loan';
import {
  MAX_LOAN_RATE_BP,
  MAX_LOAN_TENURE_MONTHS,
  RATE_TOO_HIGH_MESSAGE,
  TENURE_OUT_OF_RANGE_MESSAGE,
  rateProblem,
  tenureProblem,
} from './loanLimits';

describe('loan input limits', () => {
  it('accepts every rate up to 100% a year and rejects anything above', () => {
    expect(rateProblem(0)).toBeNull();
    expect(rateProblem(MAX_LOAN_RATE_BP)).toBeNull();
    expect(rateProblem(MAX_LOAN_RATE_BP + 1)).toBe(RATE_TOO_HIGH_MESSAGE);
    expect(rateProblem(10000000)).toBe(RATE_TOO_HIGH_MESSAGE);
  });

  it('accepts whole-month tenures up to 50 years, and rejects fractions and longer', () => {
    expect(tenureProblem(1)).toBeNull();
    expect(tenureProblem(MAX_LOAN_TENURE_MONTHS)).toBeNull();
    expect(tenureProblem(12.5)).toBe(TENURE_OUT_OF_RANGE_MESSAGE);
    expect(tenureProblem(MAX_LOAN_TENURE_MONTHS + 1)).toBe(TENURE_OUT_OF_RANGE_MESSAGE);
  });

  it('keeps the EMI finite at the very edge of what is allowed', () => {
    expect(Number.isFinite(calculateEmi(1_000_000_000_000, MAX_LOAN_RATE_BP, MAX_LOAN_TENURE_MONTHS))).toBe(
      true
    );
  });
});
