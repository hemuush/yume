/**
 * The invariant that matters for `allocateRoundedMinor`: whatever set of
 * exact minor-unit parts goes in, the whole-rupee values that come out
 * (a) are each a multiple of 100, and (b) sum to exactly the rounded total —
 * so a breakdown shown next to its total on screen always reconciles.
 */
import { allocateRoundedMinor, allocateAndFormat, roundedMinor } from './round';

const roundHalfAwayFromZero = (v: number) => Math.sign(v) * Math.round(Math.abs(v));
const roundedTotalRupees = (parts: number[], total?: number) =>
  roundHalfAwayFromZero((total ?? parts.reduce((s, p) => s + p, 0)) / 100);

const PART_SETS: number[][] = [
  [0],
  [10440, 10440, 10440], // 3 × ₹104.40 → must show 105 + 104 + 104 = 313
  [3333, 3333, 3334],
  [105612 - 78262, 78262], // a real loan row: principal 27350, interest 78262, emi 105612
  [1, 1, 1, 1, 1], // five paise, total 5p → all zero
  [99, 99, 99], // ₹0.99 each
  [250025, 500050, 999999],
  [-3000, 50000, -1200], // mixed sign (overdraft account in a balance list)
  [-500, -500, -500],
  [12345, 0, 0, 6789],
  [100000, 100000, 100000],
  Array.from({ length: 37 }, (_, i) => 1000 * (i + 1) + (i % 3) * 33), // many categories
];
const TOTAL_OVERRIDES: (number | undefined)[] = [undefined, 0, 314159, 100, -2200];

describe('allocateRoundedMinor — parts are whole rupees and sum to the rounded total', () => {
  for (let si = 0; si < PART_SETS.length; si++) {
    for (let ti = 0; ti < TOTAL_OVERRIDES.length; ti++) {
      const parts = PART_SETS[si];
      const override = TOTAL_OVERRIDES[ti];
      it(`set[${si}] total=${override ?? 'auto'}`, () => {
        const out = allocateRoundedMinor(parts, override);

        expect(out).toHaveLength(parts.length);
        // (a) every allocated value is a whole rupee
        for (const v of out) expect(v % 100 === 0).toBe(true);
        // (b) they sum to exactly the rounded total
        const sum = out.reduce((s, v) => s + v, 0);
        expect(sum).toBe(roundedTotalRupees(parts, override) * 100);
        // never drifts more than one rupee from its own exact part
        if (override === undefined) {
          out.forEach((v, i) => expect(Math.abs(v - parts[i])).toBeLessThan(100));
        }
      });
    }
  }
});

describe('allocateRoundedMinor — specific behaviours', () => {
  it('leaves already-whole parts untouched when no total override is given', () => {
    expect(allocateRoundedMinor([100, 200, 300])).toEqual([100, 200, 300]);
    expect(allocateRoundedMinor([-500, 1500])).toEqual([-500, 1500]);
  });

  it('distributes the extra rupee to the largest fractional remainders first', () => {
    // 0.10 + 0.80 + 0.80 = 1.70 → total 2; the two .80s get rounded up.
    expect(allocateRoundedMinor([10, 80, 80])).toEqual([0, 100, 100]);
  });

  it('breaks remainder ties by original position (stable)', () => {
    // three identical halves, total 1 → the first one gets the rupee.
    expect(allocateRoundedMinor([50, 50, 50], 100)).toEqual([100, 0, 0]);
  });

  it('reconciles a breakdown to an explicit stored total (EMI = principal + interest)', () => {
    const principal = 27350;
    const interest = 78262;
    const emi = 105612; // stored: principal + interest exactly, in paise
    const [p, i] = allocateRoundedMinor([principal, interest], emi);
    expect(p + i).toBe(roundHalfAwayFromZero(emi / 100) * 100);
  });

  it('handles an all-negative set', () => {
    const out = allocateRoundedMinor([-333, -333, -334]);
    expect(out.reduce((s, v) => s + v, 0)).toBe(-1000);
    for (const v of out) expect(v % 100 === 0).toBe(true);
  });

  it('empty input returns empty', () => {
    expect(allocateRoundedMinor([])).toEqual([]);
  });
});

describe('roundedMinor — one exact amount to its displayed whole rupee', () => {
  for (const [minor, expected] of [
    [0, 0],
    [49, 0],
    [50, 100],
    [149, 100],
    [150, 200],
    [20555, 20600],
    [-49, 0],
    [-50, -100],
    [-25099, -25100],
    [1927156, 1927200],
  ] as const) {
    it(`${minor} -> ${expected}`, () => {
      expect(roundedMinor(minor)).toBe(expected);
      expect(roundedMinor(minor) % 100 === 0).toBe(true);
    });
  }

  it('is idempotent on an already-whole value', () => {
    for (const v of [0, 100, -300, 500000]) expect(roundedMinor(v)).toBe(v);
  });

  it('allocateAndFormat maps each allocated value through the formatter', () => {
    // 3 × ₹104.40 = ₹313.20 → shows as 313; the spare rupee goes to the
    // first entry (equal remainders, stable tie-break).
    const out = allocateAndFormat([10440, 10440, 10440], (m) => String(m / 100));
    expect(out).toEqual(['105', '104', '104']);
    expect(out.reduce((s, v) => s + Number(v), 0)).toBe(313);
  });
});
