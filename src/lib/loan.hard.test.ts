/** Seeded random schedule invariants for the whole-rupee loan maths. */
import { calculateEmi, generateAmortizationSchedule, recalculateAfterPrepayment } from '@/lib/loan';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

function cases() {
  const r = rng(20260101);
  const out: { principal: number; rate: number; tenure: number }[] = [];
  const principals = [100, 200, 500, 100000, 5000000, 123400, 99999900, 1000000000];
  const rates = [0, 1, 50, 950, 1200, 3600, 10000];
  const tenures = [1, 2, 3, 12, 60, 360, 600];
  for (const principal of principals)
    for (const rate of [0, 10000]) for (const tenure of [1, 600]) out.push({ principal, rate, tenure });
  for (let i = 0; i < 400; i++) {
    out.push({
      principal: r() < 0.5 ? pick(r, principals) : (1 + Math.floor(r() * 5000000)) * 100,
      rate: r() < 0.5 ? pick(r, rates) : Math.floor(r() * 10001),
      tenure: r() < 0.5 ? pick(r, tenures) : 1 + Math.floor(r() * 600),
    });
  }
  return out;
}

describe('amortization schedule invariants', () => {
  it.each(cases().map((c) => [`${c.principal}p ${c.rate}bp ${c.tenure}m`, c] as const))(
    '%s',
    (_n, { principal, rate, tenure }) => {
      const emi = calculateEmi(principal, rate, tenure);
      expect(emi % 100).toBe(0);
      expect(emi).toBeGreaterThan(0);
      const s = generateAmortizationSchedule({
        loanId: 'L',
        principalMinor: principal,
        annualRateBp: rate,
        tenureMonths: tenure,
        startDate: '2026-01-31',
      });
      expect(s.length).toBeGreaterThan(0);
      expect(s.length).toBeLessThanOrEqual(tenure);
      let left = principal;
      for (const p of s) {
        expect(p.outstandingAfterMinor).toBeGreaterThanOrEqual(0);
        expect(p.principalComponentMinor).toBeGreaterThan(0);
        expect(p.emiAmountMinor % 100).toBe(0);
        expect(p.interestComponentMinor % 100).toBe(0);
        expect(p.emiAmountMinor).toBe(p.principalComponentMinor + p.interestComponentMinor);
        left -= p.principalComponentMinor;
        expect(p.outstandingAfterMinor).toBe(left);
      }
      expect(s[s.length - 1].outstandingAfterMinor).toBe(0);
      expect(s.reduce((a, p) => a + p.principalComponentMinor, 0)).toBe(principal);
    }
  );

  it('prepayment recalculation from a random balance reaches zero with whole rupees', () => {
    const r = rng(7);
    for (let i = 0; i < 200; i++) {
      const principal = (1000 + Math.floor(r() * 2000000)) * 100;
      const rate = Math.floor(r() * 3001);
      const tenure = 2 + Math.floor(r() * 300);
      const emi = calculateEmi(principal, rate, tenure);
      const outstanding = (1 + Math.floor(r() * (principal / 100))) * 100;
      const s = recalculateAfterPrepayment({
        loanId: 'L',
        outstandingPrincipalMinor: outstanding,
        annualRateBp: rate,
        emiAmountMinor: emi,
        fromInstallmentNumber: 5,
        fromDate: '2026-05-10',
      });
      if (!s.length) continue; // EMI below interest: documented non-amortizing case
      expect(s[s.length - 1].outstandingAfterMinor).toBe(0);
      expect(s.reduce((a, p) => a + p.principalComponentMinor, 0)).toBe(outstanding);
      expect(s.every((p) => p.emiAmountMinor % 100 === 0 && p.outstandingAfterMinor >= 0)).toBe(true);
      expect(s[0].installmentNumber).toBe(5);
    }
  });
});
