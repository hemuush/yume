import { moonLitPath, ringArcs } from './moonPhase';

describe('ringArcs', () => {
  it('lays the slices end to end from the top, with a hairline between them', () => {
    const arcs = ringArcs([0.25, 0.25, 0.5]);
    expect(arcs.map((a) => a.offset)).toEqual([-0, -25, -50]);
    expect(arcs.map((a) => a.len)).toEqual([23.8, 23.8, 48.8]);
  });

  it('draws a very thin slice whole and an empty one not at all', () => {
    const arcs = ringArcs([0.004, 0, 0.5]);
    expect(arcs[0].len).toBeCloseTo(0.4);
    expect(arcs[1].len).toBe(0);
    expect(arcs[2].offset).toBeCloseTo(-0.4);
  });

  it('never goes negative for a negative share', () => {
    expect(ringArcs([-0.2])[0].len).toBe(0);
  });
});

describe('moonLitPath', () => {
  it('is empty for a new moon', () => {
    expect(moonLitPath(0, 68, 68, 45)).toBe('');
    expect(moonLitPath(-0.3, 68, 68, 45)).toBe('');
  });

  it('is the whole disc for a full moon', () => {
    expect(moonLitPath(1, 68, 68, 45)).toBe('M68 23 A45 45 0 1 1 67.99 23 Z');
    expect(moonLitPath(7, 68, 68, 45)).toContain('A45 45 0 1 1');
  });

  it('is a half disc at 50%, its terminator a straight line', () => {
    expect(moonLitPath(0.5, 68, 68, 45)).toBe('M68 23 A45 45 0 0 1 68 113 A0.00 45 0 0 0 68 23 Z');
  });

  it('bulges the terminator right for a crescent and left for a gibbous moon', () => {
    expect(moonLitPath(0.25, 68, 68, 45)).toBe('M68 23 A45 45 0 0 1 68 113 A22.50 45 0 0 0 68 23 Z');
    expect(moonLitPath(0.75, 68, 68, 45)).toBe('M68 23 A45 45 0 0 1 68 113 A22.50 45 0 0 1 68 23 Z');
  });
});
