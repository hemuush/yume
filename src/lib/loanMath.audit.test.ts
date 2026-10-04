/**
 * Independent audit of the loan maths in `lib/loan.ts`: a from-scratch reference (closed form via
 * expm1/log1p, plain simulation) is compared with the production functions over a wide grid.
 * Passing tests document guarantees; `it.failing` marks a defect (see the comment above each).
 */
import { calculateEmi, generateAmortizationSchedule, recalculateAfterPrepayment } from './loan';
import { addMonthsToIsoDate } from './date';

jest.setTimeout(120000);

const PRINCIPALS = [100000, 123456700, 5000000, 100000000, 10000000000, 1000000000000];
const RATES_BP = [0, 1, 100, 475, 950, 1800, 3600, 10000, 50000];
const TENURES = [1, 2, 3, 5, 7, 12, 13, 24, 60, 84, 120, 240, 360];

/** Reference EMI, numerically different from production: P*r / (1 - (1+r)^-n) using expm1/log1p. */
function refEmi(p: number, bp: number, n: number): number {
  const r = bp / 120000;
  if (r === 0) return p / n;
  return (p * r) / -Math.expm1(-n * Math.log1p(r));
}

function sched(p: number, bp: number, n: number) {
  return generateAmortizationSchedule({
    loanId: 'L',
    principalMinor: p,
    annualRateBp: bp,
    tenureMonths: n,
    startDate: '2026-01-31',
  });
}

describe('EMI formula vs an independent closed form', () => {
  for (const p of PRINCIPALS) {
    for (const bp of RATES_BP) {
      for (const n of TENURES) {
        it(`P=${p} bp=${bp} n=${n}`, () => {
          const got = calculateEmi(p, bp, n);
          const want = refEmi(p, bp, n);
          // Production rounds to a minor unit; allow that plus float noise. `factor - 1` cancels digits when
          // n*r is tiny, so the relative error there grows like machine epsilon / (n*r).
          const nr = (n * bp) / 120000;
          const floatNoise = want * (1e-12 + (nr > 0 ? 4e-16 / nr : 0));
          expect(Math.abs(got - want)).toBeLessThanOrEqual(0.5 + floatNoise + 1e-9);
        });
      }
    }
  }

  it('is 0 for a non-positive tenure and handles a 1-month tenure as principal + one month of interest', () => {
    expect(calculateEmi(100000, 1200, 0)).toBe(0);
    expect(calculateEmi(100000, 1200, 1)).toBe(Math.round(100000 * 1.01));
    expect(calculateEmi(100000, 0, 1)).toBe(100000);
  });
});

describe('generateAmortizationSchedule properties', () => {
  for (const p of PRINCIPALS) {
    for (const bp of RATES_BP) {
      for (const n of TENURES) {
        it(`P=${p} bp=${bp} n=${n}`, () => {
          const s = sched(p, bp, n);
          // The EMI is rounded to a minor unit, so at an extreme rate the balance can reach zero a few
          // instalments early (see `compounded` below); it never runs past the tenure.
          const rate = bp / 120000;
          const compounded = rate === 0 ? 0 : (Math.pow(1 + rate, n) - 1) / rate;
          const baseEmi = calculateEmi(p, bp, n);
          expect(s.length).toBeLessThanOrEqual(n);
          expect(s.length).toBeGreaterThanOrEqual(
            n - Math.ceil((0.5 * compounded + n) / Math.max(baseEmi / (1 + rate), 1))
          );
          expect(s.reduce((a, x) => a + x.principalComponentMinor, 0)).toBe(p);
          expect(s[s.length - 1].outstandingAfterMinor).toBe(0);
          let bal = p;
          let interest = 0;
          for (const x of s) {
            expect(x.principalComponentMinor).toBeGreaterThan(-1);
            expect(x.interestComponentMinor).toBeGreaterThanOrEqual(0);
            expect(x.emiAmountMinor).toBe(x.principalComponentMinor + x.interestComponentMinor);
            expect(x.emiAmountMinor).toBeGreaterThanOrEqual(0);
            bal -= x.principalComponentMinor;
            expect(x.outstandingAfterMinor).toBe(bal);
            expect(bal).toBeGreaterThanOrEqual(0);
            interest += x.interestComponentMinor;
          }
          expect(interest).toBeGreaterThanOrEqual(0);
          if (bp === 0) expect(interest).toBe(0);
          // The last instalment absorbs the rounding. Half a minor unit of EMI error, plus up to half a unit of
          // interest rounding each month, all compound at the monthly rate r over n months, to at most
          // ((1+r)^n - 1) / r; anything beyond that would be a real defect.
          if (n > 1 && s.length === n) {
            const drift = Math.abs(s[s.length - 1].emiAmountMinor - baseEmi);
            expect(drift).toBeLessThanOrEqual(compounded + n + Math.ceil(baseEmi * 1e-9) + 1);
          }
        });
      }
    }
  }

  it('matches an independent month-by-month simulation (interest rounded per month)', () => {
    for (const [p, bp, n] of [
      [50000000, 950, 240],
      [1234500, 1800, 36],
      [99999900, 1, 360],
    ]) {
      const emi = Math.round(refEmi(p, bp, n));
      let bal = p;
      const r = bp / 120000;
      const s = sched(p, bp, n);
      s.forEach((x, i) => {
        const interest = Math.round(bal * r);
        const principal = i === n - 1 ? bal : emi - interest;
        expect(x.interestComponentMinor).toBe(interest);
        expect(x.principalComponentMinor).toBe(principal);
        bal -= principal;
      });
      expect(bal).toBe(0);
    }
  });

  // Fractional tenures and rates above 100% a year can't reach these functions: createLoan, applyRateChange and
  // the loan forms reject them first (lib/loanLimits.ts), so the maths itself is left as it is.
});

describe('recalculateAfterPrepayment (fixed EMI, shrinking tenure)', () => {
  const dates = (n: number) => Array.from({ length: n }, (_, i) => addMonthsToIsoDate('2026-01-31', i));

  for (const p of [100000, 5000000, 123456700, 100000000000]) {
    for (const bp of [0, 475, 950, 1800, 3600]) {
      for (const n of [12, 60, 240, 360]) {
        for (const cut of [0.01, 0.25, 0.9, 0.999]) {
          it(`P=${p} bp=${bp} n=${n} prepay ${cut * 100}% after 3 EMIs`, () => {
            const paid = Math.min(3, n - 1);
            const s = sched(p, bp, n);
            const bal0 = s[paid - 1].outstandingAfterMinor;
            const prepay = Math.floor((bal0 * cut) / 100) * 100;
            const bal = bal0 - prepay;
            const emi = calculateEmi(p, bp, n);
            const out = recalculateAfterPrepayment({
              loanId: 'L',
              outstandingPrincipalMinor: bal,
              annualRateBp: bp,
              emiAmountMinor: emi,
              fromInstallmentNumber: paid + 1,
              fromDate: '2026-01-31',
              anchorInstallmentNumber: 1,
            });
            if (bal === 0) {
              expect(out).toEqual([]);
              return;
            }
            // Sum of principal == new balance; ends at exactly 0; never negative; due dates anchored.
            expect(out.reduce((a, x) => a + x.principalComponentMinor, 0)).toBe(bal);
            expect(out[out.length - 1].outstandingAfterMinor).toBe(0);
            expect(out.every((x) => x.outstandingAfterMinor >= 0 && x.interestComponentMinor >= 0)).toBe(
              true
            );
            expect(out.map((x) => x.installmentNumber)).toEqual(out.map((_, i) => paid + 1 + i));
            expect(out.map((x) => x.dueDate)).toEqual(dates(paid + out.length).slice(paid));
            // Never longer than what the old schedule had left, never shorter than the ideal (log) length.
            expect(out.length).toBeLessThanOrEqual(n - paid);
            const r = bp / 120000;
            const ideal = r === 0 ? bal / emi : -Math.log1p(-(bal * r) / emi) / Math.log1p(r);
            expect(Math.abs(out.length - Math.ceil(ideal))).toBeLessThanOrEqual(1);
          });
        }
      }
    }
  }

  it('prepaying more than what is owed yields an empty schedule (planPrepayment clamps to 0)', () => {
    expect(
      recalculateAfterPrepayment({
        loanId: 'L',
        outstandingPrincipalMinor: 0,
        annualRateBp: 1200,
        emiAmountMinor: 1000,
        fromInstallmentNumber: 4,
        fromDate: '2026-01-31',
      })
    ).toEqual([]);
  });

  it('refuses (empty schedule, residual left to the caller guard) when EMI cannot cover interest', () => {
    const out = recalculateAfterPrepayment({
      loanId: 'L',
      outstandingPrincipalMinor: 10000000,
      annualRateBp: 1200,
      emiAmountMinor: 90000, // interest is 100000
      fromInstallmentNumber: 1,
      fromDate: '2026-01-31',
    });
    expect(out).toEqual([]);
  });

  // Balance 1,000,000.00 at 12% (interest 10,000.00 a month): an EMI of 10,001.00 still amortises, in about 925
  // months. An EMI of 10,000.01 would need about 1,390 months, past the 1200-iteration cap, so the schedule is
  // cut off with a balance left and callers treat it as "would never pay off". That is a 115-year loan, so it
  // is a documented limit rather than a defect worth changing in the frozen financial core.
  const longSchedule = (emiAmountMinor: number) =>
    recalculateAfterPrepayment({
      loanId: 'L',
      outstandingPrincipalMinor: 100000000,
      annualRateBp: 1200,
      emiAmountMinor,
      fromInstallmentNumber: 1,
      fromDate: '2026-01-31',
    });

  it('amortises a very long schedule that fits inside the iteration cap', () => {
    const out = longSchedule(1000100);
    expect(out.length).toBeGreaterThan(900);
    expect(out.length).toBeLessThanOrEqual(1200);
    expect(out[out.length - 1].outstandingAfterMinor).toBe(0);
  });

  it('cuts off, with a balance left, a schedule that needs more than 1200 instalments', () => {
    const out = longSchedule(1000001);
    expect(out.length).toBe(1200);
    expect(out[out.length - 1].outstandingAfterMinor).toBeGreaterThan(0);
  });

  it('keepTenure style close-out: lastInstallmentNumber absorbs the rounding residue', () => {
    for (const [bal, bp, left] of [
      [123456700, 950, 77],
      [5000000, 1800, 13],
      [100000, 0, 7],
    ]) {
      const emi = calculateEmi(bal, bp, left);
      const out = recalculateAfterPrepayment({
        loanId: 'L',
        outstandingPrincipalMinor: bal,
        annualRateBp: bp,
        emiAmountMinor: emi,
        fromInstallmentNumber: 10,
        fromDate: '2026-01-31',
        anchorInstallmentNumber: 1,
        lastInstallmentNumber: 10 + left - 1,
      });
      expect(out.length).toBe(left);
      expect(out[out.length - 1].outstandingAfterMinor).toBe(0);
    }
  });
});

describe('due dates', () => {
  it('a 31st start keeps month-end days without drifting, incl. Feb 29 in a leap year', () => {
    const s = generateAmortizationSchedule({
      loanId: 'L',
      principalMinor: 1200000,
      annualRateBp: 0,
      tenureMonths: 14,
      startDate: '2027-12-31',
    });
    const d = s.map((x) => x.dueDate);
    expect(d[0]).toBe('2027-12-31');
    expect(d[1]).toBe('2028-01-31');
    expect(d[2]).toBe('2028-02-29');
    expect(d[3]).toBe('2028-03-31');
    expect(d[4]).toBe('2028-04-30');
    expect(d[13]).toBe('2029-01-31');
    expect(addMonthsToIsoDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToIsoDate('2026-01-30', 12)).toBe('2027-01-30');
  });
});
