import { hexToHsl, hslToHex, shade } from './color';

// Helper: how far apart two hex colours are, channel-by-channel — used
// instead of exact string equality since HSL<->RGB round-trips through
// floating point and rounding.
function maxChannelDiff(a: string, b: string): number {
  const parse = (hex: string) => {
    const c = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
}

describe('hexToHsl / hslToHex', () => {
  it('round-trips known colours within rounding error', () => {
    for (const hex of ['#E0F0A8', '#12130F', '#FFFFFF', '#000000', '#8FCBFF', '#FFA8CE']) {
      const [h, s, l] = hexToHsl(hex);
      expect(maxChannelDiff(hslToHex(h, s, l), hex)).toBeLessThanOrEqual(1);
    }
  });

  it('reads pure white and black correctly', () => {
    expect(hexToHsl('#FFFFFF')[2]).toBeCloseTo(100, 0);
    expect(hexToHsl('#000000')[2]).toBeCloseTo(0, 0);
  });

  it('accepts a leading # or none, and 3-digit shorthand', () => {
    expect(hexToHsl('E0F0A8')).toEqual(hexToHsl('#E0F0A8'));
    expect(hslToHex(...hexToHsl('#fff'))).toBe(hslToHex(...hexToHsl('#ffffff')));
  });
});

describe('shade', () => {
  it('produces the requested lightness while keeping the hue', () => {
    const base = '#E0F0A8'; // sage
    const [baseHue] = hexToHsl(base);
    for (const l of [20, 45, 68, 90]) {
      const [h, , actualL] = hexToHsl(shade(base, l));
      expect(actualL).toBeCloseTo(l, 0);
      expect(h).toBeCloseTo(baseHue, 0);
    }
  });

  it('a deep shade and a light shade of the same base are visibly different colours', () => {
    const base = '#8FCBFF'; // sky
    const deep = shade(base, 42);
    const light = shade(base, 78);
    expect(maxChannelDiff(deep, light)).toBeGreaterThan(60);
  });

  it('saturationDelta nudges saturation without changing hue/lightness', () => {
    const base = '#E0AC3F';
    const [h, s, l] = hexToHsl(base);
    const boosted = shade(base, l, 10);
    const [h2, s2, l2] = hexToHsl(boosted);
    expect(h2).toBeCloseTo(h, 0);
    expect(l2).toBeCloseTo(l, 0);
    expect(s2).toBeCloseTo(Math.min(100, s + 10), 0);
  });
});
