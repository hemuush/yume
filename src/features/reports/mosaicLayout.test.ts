import { squarify } from './mosaicLayout';

const area = (t: { width: number; height: number }) => t.width * t.height;

describe('squarify', () => {
  const values = [2600000, 2200000, 1500000, 1000000, 800000, 500000, 350000, 300000, 200000];
  const W = 320;
  const H = 220;
  const tiles = squarify(values, W, H);

  it('gives every value a tile whose area is its share of the box', () => {
    expect(tiles.map((t) => t.index).sort((a, b) => a - b)).toEqual(values.map((_, i) => i));
    const total = values.reduce((s, v) => s + v, 0);
    for (const t of tiles) {
      expect(area(t) / (W * H)).toBeCloseTo(values[t.index] / total, 3);
    }
  });

  it('fills the box exactly, with every tile inside it', () => {
    expect(tiles.reduce((s, t) => s + area(t), 0)).toBeCloseTo(W * H, 3);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(-1e-6);
      expect(t.y).toBeGreaterThanOrEqual(-1e-6);
      expect(t.x + t.width).toBeLessThanOrEqual(W + 1e-6);
      expect(t.y + t.height).toBeLessThanOrEqual(H + 1e-6);
    }
  });

  it('never overlaps two tiles', () => {
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i];
        const b = tiles[j];
        const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapH = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(overlapW > 1e-6 && overlapH > 1e-6).toBe(false);
      }
    }
  });

  it('keeps tiles roughly square rather than slicing them thin', () => {
    const worst = Math.max(...tiles.map((t) => Math.max(t.width / t.height, t.height / t.width)));
    expect(worst).toBeLessThan(4);
  });

  it('gives one value the whole box, and skips zeros', () => {
    expect(squarify([5], 100, 50)).toEqual([{ index: 0, x: 0, y: 0, width: 100, height: 50 }]);
    expect(squarify([5, 0], 100, 50).map((t) => t.index)).toEqual([0]);
    expect(squarify([], 100, 50)).toEqual([]);
    expect(squarify([5], 0, 50)).toEqual([]);
  });
});
