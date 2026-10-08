import { uiScaleFor } from './uiScale';

describe('uiScaleFor', () => {
  it('leaves the default size alone', () => expect(uiScaleFor(1)).toBe(1));
  it('shrinks half as fast as a small font', () => expect(uiScaleFor(0.85)).toBeCloseTo(0.925));
  it('grows half as fast as a large font', () => expect(uiScaleFor(1.3)).toBeCloseTo(1.15));
  it('stops following at the font-scale limit and at a tiny font', () => {
    expect(uiScaleFor(2)).toBeCloseTo(1.15);
    expect(uiScaleFor(0.5)).toBeCloseTo(0.9);
  });
});
