import { PALETTES } from './palette';

function luminance(hex: string) {
  const [r, g, b] = hex
    .slice(1, 7)
    .match(/../g)!
    .map((part) => {
      const value = parseInt(part, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe.each(['light', 'dark'] as const)('body text in %s mode', (scheme) => {
  const c = PALETTES[scheme];
  const surfaces = { page: c.background, card: c.surface, raised: c.surfaceAlt, control: c.home.control };
  const roles = { textPrimary: c.textPrimary, textSecondary: c.textSecondary, textMuted: c.textMuted };

  it.each(Object.keys(roles) as (keyof typeof roles)[])('keeps %s readable on every surface', (role) => {
    for (const [name, fill] of Object.entries(surfaces)) {
      expect({ role, name, ratio: contrast(roles[role], fill) >= 4.5 }).toEqual({ role, name, ratio: true });
    }
  });
});
