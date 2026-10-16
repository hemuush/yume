import { moneyBarSegments } from './moneyBar';
import { heroSlices, withoutSavings } from './heroSlices';

describe('moneyBarSegments', () => {
  it('lists spent, saved, still to pay and free in that order', () => {
    const segs = moneyBarSegments(heroSlices(10_000, 4_000, 3_000, 1_000));
    expect(segs.map((s) => s.key)).toEqual(['spent', 'saved', 'due', 'free']);
    expect(segs.map((s) => s.share)).toEqual([0.4, 0.3, 0.1, 0.2]);
  });

  it('leaves out what is empty', () => {
    expect(moneyBarSegments(heroSlices(10_000, 4_000, 0)).map((s) => s.key)).toEqual(['spent', 'free']);
  });

  it('is all spent when more went out than came in', () => {
    expect(moneyBarSegments(heroSlices(10_000, 12_000, 0))).toEqual([{ key: 'spent', share: 1 }]);
  });

  it('has no bar without income', () => {
    expect(moneyBarSegments(heroSlices(0, 5_000, 0))).toEqual([]);
  });

  it('drops the saved part while savings are hidden, so the bar ends early', () => {
    const segs = moneyBarSegments(withoutSavings(heroSlices(10_000, 4_000, 3_000)));
    expect(segs.map((s) => s.key)).toEqual(['spent', 'free']);
    expect(segs.reduce((sum, s) => sum + s.share, 0)).toBeLessThan(1);
  });
});
