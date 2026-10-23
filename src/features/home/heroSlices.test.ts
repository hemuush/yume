import { heroSlices, heroPct, withoutSavings } from './heroSlices';

const sum = (s: { spent: number; saved: number; free: number }) => s.spent + s.saved + s.free;

describe('heroSlices', () => {
  it('splits a normal month into spent, savings and free to use that add up to income', () => {
    // Ã¢â€šÂ¹1,80,000 in, Ã¢â€šÂ¹82,000 out, Ã¢â€šÂ¹97,000 to savings.
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

  it('gives bills still to pay their own slice out of what would be free', () => {
    // Ã¢â€šÂ¹1,000 in, Ã¢â€šÂ¹100 out, Ã¢â€šÂ¹300 to savings, Ã¢â€šÂ¹200 still to pay Ã¢â€ â€™ Ã¢â€šÂ¹400 free after bills.
    const s = heroSlices(100000, 10000, 30000, 20000);
    expect(s.due).toBeCloseTo(0.2);
    expect(s.free).toBeCloseTo(0.4);
    expect(sum(s) + (s.due ?? 0)).toBeCloseTo(1);
  });

  it('never lets the due slice pass what was left, and omits it when nothing is due', () => {
    const s = heroSlices(100000, 10000, 30000, 900000);
    expect(s.due).toBeCloseTo(0.6);
    expect(s.free).toBe(0);
    expect(heroSlices(100000, 10000, 30000)).not.toHaveProperty('due');
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

describe('with savings hidden', () => {
  it('drops the savings arc and leaves free at its real share', () => {
    const s = withoutSavings(heroSlices(100000, 10000, 60000));
    expect(s.saved).toBe(0);
    expect(s.spent).toBeCloseTo(0.1);
    expect(s.free).toBeCloseTo(0.3);
  });
});
