import { hexToHsl, hslToHex, shade, hexToRgba, spendHeatScale } from './color';

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

describe('hexToRgba', () => {
  it('carries the exact RGB channels through at the given alpha', () => {
    expect(hexToRgba('#E0F0A8', 0.5)).toBe('rgba(224, 240, 168, 0.5)');
  });

  it('accepts 3-digit shorthand', () => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('spendHeatScale', () => {
  it('produces 5 steps, increasingly opaque, for every accent swatch', () => {
    const swatches = ['#E0F0A8', '#8FE8C8', '#8FCBFF', '#C9B8FF', '#FFA8CE', '#F0A387', '#5FB3A8', '#E0AC3F'];
    for (const accent of swatches) {
      const scale = spendHeatScale(accent);
      expect(scale).toHaveLength(5);
      expect(scale[0]).toBe('transparent');
      const alphaOf = (rgba: string) => Number(rgba.slice(rgba.lastIndexOf(',') + 1, -1));
      const alphas = scale.slice(1).map(alphaOf);
      for (let i = 1; i < alphas.length; i++) {
        expect(alphas[i]).toBeGreaterThan(alphas[i - 1]);
      }
    }
  });

  it('the two deepest steps stay the same hue as the accent', () => {
    const accent = '#8FCBFF'; // sky
    const [accentHue] = hexToHsl(accent);
    const scale = spendHeatScale(accent);
    const rgbaHue = (rgba: string) => {
      const [r, g, b] = rgba
        .slice(rgba.indexOf('(') + 1, rgba.lastIndexOf(','))
        .split(',')
        .map(Number);
      return hexToHsl(`#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`)[0];
    };
    expect(rgbaHue(scale[3])).toBeCloseTo(accentHue, -1);
    expect(rgbaHue(scale[4])).toBeCloseTo(accentHue, -1);
  });
});
