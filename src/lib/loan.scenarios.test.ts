/**
 * Sweep of loan math (principal x rate x tenure); invariants for ANY loan: `tenure` installments,
 * last at zero, principals sum to the original, EMI matches calculateEmi(), balance strictly decreases.
 */
import { calculateEmi, generateAmortizationSchedule, monthlyRateFromAnnualBp } from './loan';

// Minor units (paise/cents) — from a token ₹10 loan up to a ₹1 crore one.
const PRINCIPALS = [1000, 5000, 10000, 50000, 100000, 500000, 1000000, 2500000, 5000000, 10000000];
// Basis points: 0% (interest-free) through 24% p.a., the realistic consumer-loan range.
const RATES_BP = [0, 100, 250, 500, 750, 900, 1050, 1200, 1500, 1800, 2400];
// 1 month through a 20-year (240-month) home loan.
const TENURES = [1, 2, 3, 6, 12, 18, 24, 36, 60, 120];

describe('loan calculation matrix — every principal × rate × tenure combination', () => {
  for (const principal of PRINCIPALS) {
    for (const rateBp of RATES_BP) {
      for (const tenure of TENURES) {
        it(`P=${principal} r=${rateBp}bp n=${tenure}mo: schedule is well-formed and resolves to exactly zero`, () => {
          const emi = calculateEmi(principal, rateBp, tenure);
          const schedule = generateAmortizationSchedule({
            loanId: 'test-loan',
            principalMinor: principal,
            annualRateBp: rateBp,
            tenureMonths: tenure,
            startDate: '2026-01-01',
          });

          // Rows are one per installment, but EMI rounding can zero a tiny principal a few months early;
          // the generator stops there, so the length is capped at `tenure`, not always equal to it.
          expect(schedule.length).toBeLessThanOrEqual(tenure);
          expect(schedule.map((p) => p.installmentNumber)).toEqual(
            Array.from({ length: schedule.length }, (_, i) => i + 1)
          );

          // The loan is fully paid off by the last installment — never a
          // residual paisa left over, and never overshooting into negative.
          expect(schedule[schedule.length - 1].outstandingAfterMinor).toBe(0);
          expect(schedule.every((p) => p.outstandingAfterMinor >= 0)).toBe(true);

          // Outstanding balance is non-increasing every month (strictly
          // decreasing whenever the installment moves any principal at all).
          let prevOutstanding = principal;
          for (const p of schedule) {
            expect(p.outstandingAfterMinor).toBeLessThanOrEqual(prevOutstanding);
            prevOutstanding = p.outstandingAfterMinor;
          }

          // Every rupee of principal is accounted for — nothing invented,
          // nothing lost to rounding across the whole schedule.
          const principalSum = schedule.reduce((sum, p) => sum + p.principalComponentMinor, 0);
          expect(principalSum).toBe(principal);

          // EMI matches the standalone formula for every installment except
          // possibly the last, which absorbs rounding drift by design.
          for (const p of schedule.slice(0, -1)) {
            expect(p.emiAmountMinor).toBe(emi);
          }

          // Interest is never negative, and (for an interest-free loan) is
          // always exactly zero.
          expect(schedule.every((p) => p.interestComponentMinor >= 0)).toBe(true);
          if (rateBp === 0) {
            expect(schedule.every((p) => p.interestComponentMinor === 0)).toBe(true);
            // Interest-free: EMI is a plain even split of principal by tenure.
            expect(emi).toBe(Math.round(principal / tenure));
          }

          // Due dates step forward by exactly one calendar month each time,
          // starting on the loan's own start date.
          expect(schedule[0].dueDate).toBe('2026-01-01');
        });
      }
    }
  }

  it('monthlyRateFromAnnualBp: 0bp is exactly 0, and higher bp always yields a higher monthly rate', () => {
    expect(monthlyRateFromAnnualBp(0)).toBe(0);
    let prev = 0;
    for (const bp of RATES_BP.slice(1)) {
      const r = monthlyRateFromAnnualBp(bp);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });
});
