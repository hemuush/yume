import { guideValues, smoothPath } from './chartPath';

describe('guideValues', () => {
  it('picks round steps and includes zero', () => {
    expect(guideValues(0, 8_400_000)).toEqual([0, 2_500_000, 5_000_000, 7_500_000]);
    expect(guideValues(-1_200_000, 5_000_000)).toContain(0);
  });
  it('copes with a flat range', () => {
    expect(guideValues(0, 0)).toEqual([0]);
  });
});

describe('smoothPath', () => {
  const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  it('is empty with no points and a lone move with one', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 3, y: 4 }])).toBe('M3.0,4.0');
  });
  it('passes through every point, with one curve between each pair', () => {
    const pts = [
      { x: 0, y: 10 },
      { x: 10, y: 4 },
      { x: 20, y: 8 },
    ];
    const d = smoothPath(pts);
    expect(d.startsWith('M0.0,10.0')).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(2);
    expect(d).toContain(' 10.0,4.0');
    expect(d.endsWith('20.0,8.0')).toBe(true);
  });
  it('never overshoots between points: a flat stretch stays flat', () => {
    const d = smoothPath([
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      { x: 20, y: 5 },
    ]);
    expect(new Set(nums(d).filter((_, i) => i % 2 === 1)).size).toBe(1);
  });
  it('keeps every control point inside the range of its two neighbours', () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 100 },
      { x: 20, y: 100 },
      { x: 30, y: 0 },
    ]);
    for (const y of nums(d).filter((_, i) => i % 2 === 1)) {
      expect(y).toBeGreaterThanOrEqual(-0.001);
      expect(y).toBeLessThanOrEqual(100.001);
    }
  });
});
