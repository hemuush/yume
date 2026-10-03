/**
 * WCAG contrast for the colours that carry text or must be told apart without colour: body text needs 4.5:1,
 * graphics such as chart bar edges need 3:1. The bright expense/income and accent hues are fills and icons;
 * text uses expenseText / incomeText, which is what keeps this list short.
 */
import fs from 'fs';
import path from 'path';
import { theme } from '@/constants/theme';

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const c = theme.colors;

describe('text contrast', () => {
  it('computes known ratios', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  const grounds = { card: c.surface, page: c.background, surfaceAlt: c.surfaceAlt };
  const texts = {
    textPrimary: c.textPrimary,
    textSecondary: c.textSecondary,
    textMuted: c.textMuted,
    expenseText: c.expenseText,
    incomeText: c.incomeText,
  };

  for (const [tn, text] of Object.entries(texts)) {
    for (const [gn, ground] of Object.entries(grounds)) {
      it(`${tn} reads on ${gn}`, () => {
        expect(contrast(text, ground)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('keeps the Settings warning lines on the red text colour, not the pale coral', () => {
    expect(contrast(c.idCoralDeep, c.surface)).toBeLessThan(4.5);
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'features', 'profile', 'SettingsSection.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(/subColor=\{[^}]*idCoralDeep/);
  });
});

describe('graphic contrast', () => {
  it('Trends bar edges stand out from the card', () => {
    expect(contrast(c.textMuted, c.surface)).toBeGreaterThanOrEqual(3);
  });
});
