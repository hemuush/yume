/**
 * A full combinatorial sweep of the EMI / amortization engine — every
 * principal × rate × tenure combination in a realistic consumer-loan range,
 * each asserting the invariants that must hold for ANY loan: exactly `tenure`
 * installments (or fewer if rounding closes it early), the last landing on
 * exactly zero, principal components summing back to the principal, EMI
 * matching the standalone formula, interest never negative, and the
 * outstanding balance never increasing.
 *
 * This complements src/db/calculation.scenarios.test.ts (which drives the
 * same math through the real DB layer) with a pure-function matrix that runs
 * fast and covers far more numeric combinations.
 */
import {
  calculateEmi,
  generateAmortizationSchedule,
  recalculateAfterPrepayment,
  monthlyRateFromAnnualBp,
} from './loan';
import { addMonthsToIsoDate } from './date';

// Minor units (paise) — a ₹10 loan up to a ₹1 crore one.
const PRINCIPALS = [1000, 5000, 25000, 100000, 500000, 1000000, 2500000, 5000000, 10000000, 50000000];
// Basis points: 0% (interest-free) through 30% p.a.
const RATES_BP = [0, 100, 250, 500, 750, 900, 1050, 1200, 1500, 1800, 2400, 3000];
// 1 month through a 20-year home loan.
const TENURES = [1, 2, 3, 6, 12, 18, 24, 36, 60, 120, 180, 240];

describe('EMI / amortization matrix — every principal × rate × tenure', () => {
  for (const P of PRINCIPALS) {
    for (const rBp of RATES_BP) {
      for (const n of TENURES) {
        it(`P=${P} r=${rBp}bp n=${n}`, () => {
          const emi = calculateEmi(P, rBp, n);
          const schedule = generateAmortizationSchedule({
            loanId: 't',
            principalMinor: P,
            annualRateBp: rBp,
            tenureMonths: n,
            startDate: '2026-01-01',
          });

          // Never longer than the tenure; sequentially numbered from 1.
          expect(schedule.length).toBeGreaterThan(0);
          expect(schedule.length).toBeLessThanOrEqual(n);
          expect(schedule.map((p) => p.installmentNumber)).toEqual(schedule.map((_, i) => i + 1));

          // Resolves to exactly zero, never negative along the way.
          expect(schedule[schedule.length - 1].outstandingAfterMinor).toBe(0);
          expect(schedule.every((p) => p.outstandingAfterMinor >= 0)).toBe(true);

          // Outstanding balance is non-increasing every month.
          let prev = P;
          for (const p of schedule) {
            expect(p.outstandingAfterMinor).toBeLessThanOrEqual(prev);
            prev = p.outstandingAfterMinor;
          }

          // Every paisa of principal is accounted for — nothing invented or lost.
          expect(schedule.reduce((s, p) => s + p.principalComponentMinor, 0)).toBe(P);

          // Interest is never negative; exactly zero for an interest-free loan.
          expect(schedule.every((p) => p.interestComponentMinor >= 0)).toBe(true);
          if (rBp === 0) {
            expect(schedule.every((p) => p.interestComponentMinor === 0)).toBe(true);
            expect(emi).toBe(Math.round(P / n));
          }

          // EMI matches the standalone formula for every installment except
          // possibly the last (which absorbs rounding drift by design).
          for (const p of schedule.slice(0, -1)) {
            expect(p.emiAmountMinor).toBe(emi);
          }

          // emiAmount == principalComponent + interestComponent, always.
          for (const p of schedule) {
            expect(p.emiAmountMinor).toBe(p.principalComponentMinor + p.interestComponentMinor);
          }

          // Due dates step exactly one calendar month, from the start date.
          expect(schedule[0].dueDate).toBe('2026-01-01');
          expect(schedule[schedule.length - 1].dueDate).toBe(
            addMonthsToIsoDate('2026-01-01', schedule.length - 1)
          );
        });
      }
    }
  }
});

describe('monthlyRateFromAnnualBp — 0 maps to 0, and is strictly increasing in bp', () => {
  it('0bp is exactly 0', () => {
    expect(monthlyRateFromAnnualBp(0)).toBe(0);
  });
  for (let i = 1; i < RATES_BP.length; i++) {
    it(`${RATES_BP[i - 1]}bp < ${RATES_BP[i]}bp`, () => {
      expect(monthlyRateFromAnnualBp(RATES_BP[i])).toBeGreaterThan(monthlyRateFromAnnualBp(RATES_BP[i - 1]));
    });
  }
  for (const bp of RATES_BP) {
    it(`${bp}bp equals bp/10000/12`, () => {
      expect(monthlyRateFromAnnualBp(bp)).toBeCloseTo(bp / 10000 / 12, 15);
    });
  }
});

describe('EMI is monotonic in its inputs', () => {
  // Higher principal → higher EMI (same rate & tenure).
  for (const rBp of [0, 500, 1050, 2400]) {
    for (const n of [12, 60, 240]) {
      it(`EMI increases with principal (r=${rBp}, n=${n})`, () => {
        let last = -1;
        for (const P of PRINCIPALS) {
          const emi = calculateEmi(P, rBp, n);
          expect(emi).toBeGreaterThan(last);
          last = emi;
        }
      });
    }
  }
  // Higher rate → higher (or equal) EMI (same principal & tenure).
  for (const P of [100000, 1000000, 10000000]) {
    for (const n of [12, 60, 240]) {
      it(`EMI non-decreasing with rate (P=${P}, n=${n})`, () => {
        let last = -1;
        for (const rBp of RATES_BP) {
          const emi = calculateEmi(P, rBp, n);
          expect(emi).toBeGreaterThanOrEqual(last);
          last = emi;
        }
      });
    }
  }
  // Longer tenure → lower (or equal) EMI (same principal & rate).
  for (const P of [100000, 1000000, 10000000]) {
    for (const rBp of [0, 900, 1800]) {
      it(`EMI non-increasing with tenure (P=${P}, r=${rBp})`, () => {
        let last = Infinity;
        for (const n of TENURES) {
          const emi = calculateEmi(P, rBp, n);
          expect(emi).toBeLessThanOrEqual(last);
          last = emi;
        }
      });
    }
  }
});

describe('recalculateAfterPrepayment — a lump-sum prepayment shortens tenure, never lengthens it', () => {
  for (const P of [200000, 1000000, 5000000]) {
    for (const rBp of [500, 900, 1500]) {
      for (const n of [24, 60, 120]) {
        for (const prepayFrac of [0.1, 0.25, 0.5]) {
          it(`P=${P} r=${rBp} n=${n} prepay ${prepayFrac * 100}% at installment 7`, () => {
            const original = generateAmortizationSchedule({
              loanId: 'p',
              principalMinor: P,
              annualRateBp: rBp,
              tenureMonths: n,
              startDate: '2026-01-01',
            });
            const emi = original[0].emiAmountMinor;
            const outstandingAt6 = original[5].outstandingAfterMinor;
            const prepay = Math.round(outstandingAt6 * prepayFrac);
            const newOutstanding = outstandingAt6 - prepay;

            const rest = recalculateAfterPrepayment({
              loanId: 'p',
              outstandingPrincipalMinor: newOutstanding,
              annualRateBp: rBp,
              emiAmountMinor: emi,
              fromInstallmentNumber: 7,
              fromDate: '2026-07-01',
            });

            expect(rest.length).toBeGreaterThan(0);
            expect(rest[rest.length - 1].outstandingAfterMinor).toBe(0);
            // Closes at least as fast as it would have without the prepayment.
            expect(rest.length).toBeLessThanOrEqual(original.length - 6);
            // Principal in the new tail sums to exactly the reduced outstanding.
            expect(rest.reduce((s, r) => s + r.principalComponentMinor, 0)).toBe(newOutstanding);
            // EMI never rises above the original in a keep-EMI recalculation.
            expect(rest.every((r) => r.emiAmountMinor <= emi)).toBe(true);
          });
        }
      }
    }
  }

  it('stops (returns an empty schedule) whenever the EMI cannot cover the monthly interest', () => {
    for (const P of [500000, 5000000, 50000000]) {
      for (const rBp of [1200, 1800, 3000]) {
        const monthlyInterest = Math.round(P * monthlyRateFromAnnualBp(rBp));
        const rest = recalculateAfterPrepayment({
          loanId: 'x',
          outstandingPrincipalMinor: P,
          annualRateBp: rBp,
          emiAmountMinor: monthlyInterest, // exactly interest, zero principal
          fromInstallmentNumber: 1,
          fromDate: '2026-01-01',
        });
        expect(rest.length).toBe(0);
      }
    }
  });
});
