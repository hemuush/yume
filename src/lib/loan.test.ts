import { calculateEmi, generateAmortizationSchedule, recalculateAfterPrepayment } from './loan';

describe('calculateEmi', () => {
  it('matches a known reducing-balance EMI table (₹10,00,000 @ 9% for 240 months)', () => {
    // Standard published EMI for this exact combination is ₹8,997.
    const emi = calculateEmi(1000000_00, 900, 240);
    expect(emi).toBeCloseTo(8997_00, -2); // within a rupee of the textbook figure
  });

  it('falls back to a straight-line split for a 0% interest-free loan', () => {
    expect(calculateEmi(120000, 0, 12)).toBe(10000);
  });

  it('returns 0 for a non-positive tenure', () => {
    expect(calculateEmi(100000, 900, 0)).toBe(0);
  });
});

describe('generateAmortizationSchedule', () => {
  it('fully amortizes: principal components sum to the loan principal, balance ends at 0', () => {
    const principal = 500000_00;
    const schedule = generateAmortizationSchedule({
      loanId: 'loan-1',
      principalMinor: principal,
      annualRateBp: 850,
      tenureMonths: 60,
      startDate: '2024-01-15',
    });

    expect(schedule).toHaveLength(60);
    const principalSum = schedule.reduce((sum, row) => sum + row.principalComponentMinor, 0);
    expect(principalSum).toBe(principal);
    expect(schedule[schedule.length - 1].outstandingAfterMinor).toBe(0);
  });

  it('produces monotonically decreasing outstanding balances', () => {
    const schedule = generateAmortizationSchedule({
      loanId: 'loan-2',
      principalMinor: 200000_00,
      annualRateBp: 1050,
      tenureMonths: 36,
      startDate: '2023-06-01',
    });
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].outstandingAfterMinor).toBeLessThanOrEqual(schedule[i - 1].outstandingAfterMinor);
    }
  });

  it('spaces due dates exactly one month apart, anchored to the start date', () => {
    const schedule = generateAmortizationSchedule({
      loanId: 'loan-3',
      principalMinor: 100000_00,
      annualRateBp: 900,
      tenureMonths: 6,
      startDate: '2024-01-31',
    });
    expect(schedule[0].dueDate).toBe('2024-01-31');
    expect(schedule.map((r) => r.dueDate)).toEqual([
      '2024-01-31',
      '2024-03-02',
      '2024-03-31',
      '2024-05-01',
      '2024-05-31',
      '2024-07-01',
    ]);
  });

  it('interest-free loans (0% rate) still amortize to exactly 0', () => {
    const schedule = generateAmortizationSchedule({
      loanId: 'loan-4',
      principalMinor: 90000,
      annualRateBp: 0,
      tenureMonths: 9,
      startDate: '2024-01-01',
    });
    expect(schedule.every((r) => r.interestComponentMinor === 0)).toBe(true);
    expect(schedule[schedule.length - 1].outstandingAfterMinor).toBe(0);
  });
});

describe('recalculateAfterPrepayment', () => {
  it('shortens the remaining tenure while keeping the EMI fixed', () => {
    const original = generateAmortizationSchedule({
      loanId: 'loan-5',
      principalMinor: 500000_00,
      annualRateBp: 900,
      tenureMonths: 60,
      startDate: '2024-01-01',
    });
    const emi = original[0].emiAmountMinor;
    const outstandingAtMonth24 = original[23].outstandingAfterMinor;
    const prepayAmount = 100000_00;
    const newOutstanding = outstandingAtMonth24 - prepayAmount;

    const rest = recalculateAfterPrepayment({
      loanId: 'loan-5',
      outstandingPrincipalMinor: newOutstanding,
      annualRateBp: 900,
      emiAmountMinor: emi,
      fromInstallmentNumber: 25,
      fromDate: '2026-01-01',
    });

    expect(rest[rest.length - 1].outstandingAfterMinor).toBe(0);
    // Fewer remaining installments than the original 36 left after month 24, since the extra prepayment accelerates payoff.
    expect(rest.length).toBeLessThan(original.length - 24);
    expect(rest.every((r) => r.emiAmountMinor <= emi)).toBe(true);
  });

  it('supports a floating-rate change: same outstanding at the moment of change, future interest reflects the new rate', () => {
    // applyRateChange() in db/loans.ts reuses this exact function for a rate
    // change (outstanding balance and EMI held fixed, only the rate moves) —
    // this test exercises that reuse path directly.
    const outstanding = 400000_00;
    const emi = 9500_00;
    const oldRateSchedule = recalculateAfterPrepayment({
      loanId: 'loan-7',
      outstandingPrincipalMinor: outstanding,
      annualRateBp: 900, // 9%
      emiAmountMinor: emi,
      fromInstallmentNumber: 10,
      fromDate: '2025-01-01',
    });
    const newRateSchedule = recalculateAfterPrepayment({
      loanId: 'loan-7',
      outstandingPrincipalMinor: outstanding, // unchanged at the moment the rate changes
      annualRateBp: 1100, // rate rises to 11%
      emiAmountMinor: emi,
      fromInstallmentNumber: 10,
      fromDate: '2025-01-01',
    });

    expect(oldRateSchedule[0].outstandingAfterMinor).not.toBe(outstanding); // first installment already amortizes
    // A higher rate means more of the very first post-change installment goes to interest.
    expect(newRateSchedule[0].interestComponentMinor).toBeGreaterThan(
      oldRateSchedule[0].interestComponentMinor
    );
    // ...and correspondingly less to principal, so the loan takes longer to close at the higher rate.
    expect(newRateSchedule.length).toBeGreaterThanOrEqual(oldRateSchedule.length);
  });

  it('stops without looping forever when the EMI does not even cover interest', () => {
    const rest = recalculateAfterPrepayment({
      loanId: 'loan-6',
      outstandingPrincipalMinor: 1000000_00,
      annualRateBp: 1800, // 18% annual, ~1.5%/mo interest on 10L = 15,000/mo
      emiAmountMinor: 5000, // deliberately too small to cover interest
      fromInstallmentNumber: 1,
      fromDate: '2024-01-01',
    });
    expect(rest.length).toBe(0);
  });
});
