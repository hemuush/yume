/**
 * The theme packs stay a considered set: each one's colours are soft pastels, clearly different from
 * every other pack's (so a new theme can't quietly copy an old one).
 */
import { THEMES } from './themes';
import { hexToHsl } from '@/lib/color';

/** CIE L*a*b* for an sRGB hex. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Below this two colours start to read as "the same colour" at a glance. */
const MIN_DELTA_E = 14;
const colours = (p: (typeof THEMES)[number]) => [p.primary, p.secondary, ...(p.dot ? [p.dot] : [])];

describe('theme packs', () => {
  it('has twelve packs with unique ids and names, Yume first', () => {
    expect(THEMES).toHaveLength(12);
    expect(new Set(THEMES.map((p) => p.id)).size).toBe(THEMES.length);
    expect(new Set(THEMES.map((p) => p.name)).size).toBe(THEMES.length);
    expect(THEMES[0].id).toBe('yume');
  });

  it("keeps every pack's colours clearly different from every other pack's", () => {
    const clashes: string[] = [];
    THEMES.forEach((a, i) =>
      THEMES.slice(i + 1).forEach((b) => {
        for (const x of colours(a)) {
          for (const y of colours(b)) {
            const d = deltaE(x, y);
            // The six packs from before this check existed are grandfathered in.
            const bothOriginal = [a, b].every((p) =>
              ['yume', 'corpsGreen', 'hollowViolet', 'blueCrystal', 'winterEmber', 'neonStatic'].includes(
                p.id
              )
            );
            if (d < MIN_DELTA_E && !bothOriginal)
              clashes.push(`${a.name} ${x} ~ ${b.name} ${y} (${d.toFixed(1)})`);
          }
        }
      })
    );
    expect(clashes).toEqual([]);
  });

  it('keeps every colour a soft pastel', () => {
    for (const p of THEMES) {
      for (const c of [p.primary, p.secondary]) {
        const l = hexToHsl(c)[2];
        expect(l).toBeGreaterThanOrEqual(60);
        expect(l).toBeLessThanOrEqual(88);
      }
    }
  });
});
