import { DIAL, dialPill, dialSpans, dialPoint } from './categoryDial';

describe('category dial geometry', () => {
  it('stretches the picked item into the pill and keeps the arc centred', () => {
    const spans = dialSpans(5, 0);
    expect(spans[0][1] - spans[0][0]).toBeCloseTo(DIAL.pill);
    expect(spans[1][1] - spans[1][0]).toBeCloseTo(DIAL.bubble);
    expect(spans[0][0]).toBeCloseTo(-spans[4][1]);
  });

  it('never overlaps two items', () => {
    for (const sel of [0, 0.4, 1, 2.5, 4]) {
      const spans = dialSpans(5, sel);
      for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThan(spans[i - 1][1]);
    }
  });

  it('puts the pill on the picked item, and halfway between two mid-glide', () => {
    expect(dialPill(5, 2)).toEqual(dialSpans(5, 2)[2]);
    const [a0] = dialPill(5, 1.5);
    const s = dialSpans(5, 1.5);
    expect(a0).toBeCloseTo((s[1][0] + s[2][0]) / 2);
  });

  it('keeps every bubble inside the dial box', () => {
    for (const [a0, a1] of dialSpans(5, 0)) {
      const p = dialPoint((a0 + a1) / 2);
      expect(p.y - DIAL.dot / 2).toBeGreaterThanOrEqual(0);
      expect(p.y + DIAL.dot / 2).toBeLessThanOrEqual(DIAL.height);
      expect(p.x + DIAL.dot / 2).toBeLessThanOrEqual(DIAL.width);
    }
  });
});
