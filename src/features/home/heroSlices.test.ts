import { heroSlices, heroPct, heroModes, heroRestingMode } from './heroSlices';

const sum = (s: { spent: number; saved: number; free: number }) => s.spent + s.saved + s.free;

describe('heroSlices', () => {
  it('splits a normal month into spent, savings and free to use that add up to income', () => {
    // ₹1,80,000 in, ₹82,000 out, ₹97,000 to savings.
    const s = heroSlices(18000000, 8200000, 9700000);
    expect(s.hasIncome).toBe(true);
    expect(s.overMinor).toBe(0);
    expect(s.spent).toBeCloseTo(8200000 / 18000000);
    expect(s.saved).toBeCloseTo(9700000 / 18000000);
    expect(s.free).toBeCloseTo(100000 / 18000000);
    expect(sum(s)).toBeCloseTo(1);
  });

  it('fills the whole moon with spent when spending passes income, and says by how much', () => {
    expect(heroSlices(100000, 130000, 20000)).toEqual({
      spent: 1,
      saved: 0,
      free: 0,
      overMinor: 30000,
      hasIncome: true,
    });
  });

  it('treats spent exactly equal to income as fully spent, not over', () => {
    const s = heroSlices(100000, 100000, 0);
    expect(s.spent).toBe(1);
    expect(s.overMinor).toBe(0);
  });

  it('caps savings at what was left after spending, leaving no free slice', () => {
    const s = heroSlices(100000, 60000, 70000);
    expect(s.saved).toBeCloseTo(0.4);
    expect(s.free).toBe(0);
    expect(sum(s)).toBeCloseTo(1);
  });

  it('counts money taken out of savings as 0 to savings, all of what is left as free', () => {
    const s = heroSlices(100000, 30000, -50000);
    expect(s.saved).toBe(0);
    expect(s.free).toBeCloseTo(0.7);
    expect(sum(s)).toBeCloseTo(1);
  });

  it('shows nothing without income, even if there was spending', () => {
    expect(heroSlices(0, 5000, 0)).toEqual({ spent: 0, saved: 0, free: 0, overMinor: 0, hasIncome: false });
  });
});

describe('heroPct', () => {
  it('rounds to a whole percent', () => {
    expect(heroPct(0.536)).toBe('54%');
    expect(heroPct(1)).toBe('100%');
    expect(heroPct(0)).toBe('0%');
  });

  it('shows a real but tiny share as "<1%" rather than "0%"', () => {
    expect(heroPct(0.003)).toBe('<1%');
  });
});

describe('heroModes / heroRestingMode', () => {
  it('offers every view in a month with all three slices, resting on Kept', () => {
    const s = heroSlices(18000000, 8200000, 9700000);
    expect(heroModes(s)).toEqual(['kept', 'spent', 'saved', 'free']);
    expect(heroRestingMode(s)).toBe('kept');
  });

  it('rests on Spent and offers nothing else when income was exactly spent', () => {
    // e.g. a salary that exactly covers an EMI: everything in went straight out.
    const s = heroSlices(2500000, 2500000, 0);
    expect(heroModes(s)).toEqual(['spent']);
    expect(heroRestingMode(s)).toBe('spent');
  });

  it('skips an empty slice', () => {
    const s = heroSlices(100000, 40000, 0);
    expect(heroModes(s)).toEqual(['kept', 'spent', 'free']);
  });

  it('offers no views when overspent or without income', () => {
    expect(heroModes(heroSlices(100000, 120000, 0))).toEqual([]);
    expect(heroModes(heroSlices(0, 0, 0))).toEqual([]);
  });
});
