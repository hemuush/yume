// lunePath lives in MoonPhase.tsx, which imports reanimated — see src/test-support/reanimatedMock.ts.
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { spentRegion, savedRegion, freeRegion } from './moonPaths';
import { lunePath } from '../reports/MoonPhase';

const d = { cx: 100, cy: 100, r: 76 };

describe('moon regions', () => {
  it('draws the free region exactly as the lune Reports already draws', () => {
    for (const k of [0, 0.1, 0.3, 0.5, 0.7, 1]) {
      expect(freeRegion(d, k)).toBe(lunePath(d.cx, d.cy, d.r, k));
    }
  });

  it('draws the spent region as the mirror of the kept lune (the left side)', () => {
    // At kept = ½ the terminator is a straight line down the middle.
    expect(spentRegion(d, 0.5)).toBe('M 100 24 A 0 76 0 0 0 100 176 A 76 76 0 0 1 100 24 Z');
    // Nothing kept: the terminator sits on the right rim, so spent is the whole disc.
    expect(spentRegion(d, 0)).toBe('M 100 24 A 76 76 0 0 1 100 176 A 76 76 0 0 1 100 24 Z');
  });

  it('bounds the saved region by the free terminator on the right and the kept one on the left', () => {
    // free ¼ (crescent, bulges right) down; kept ¾ (gibbous, bulges left) up.
    expect(savedRegion(d, 0.75, 0.25)).toBe('M 100 24 A 38 76 0 0 1 100 176 A 38 76 0 0 1 100 24 Z');
  });

  it('clamps out-of-range fractions instead of drawing past the rim', () => {
    expect(freeRegion(d, 1.4)).toBe(freeRegion(d, 1));
    expect(spentRegion(d, -0.2)).toBe(spentRegion(d, 0));
  });
});
