/**
 * WCAG contrast for the colours that carry text or must be told apart without colour: body text needs 4.5:1,
 * graphics such as chart bar edges need 3:1. The bright expense/income and accent hues are fills and icons;
 * text uses expenseText / incomeText, which is what keeps this list short.
 */
import fs from 'fs';
import path from 'path';
import { theme } from '@/constants/theme';
import { AVATAR_COLORS } from '@/lib/hueFor';
import { TYPE_WASH, typeWash } from '@/features/add/addEntry';
import { PALETTES } from '@/theme/palette';
import { contrastRatio as contrast } from '@/lib/color';

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

  it.each(Object.entries(TYPE_WASH))(
    'keeps %s entry labels readable on their keypad and card',
    (_type, wash) => {
      expect(contrast(wash.accent, wash.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(wash.accent, c.surface)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('keeps transfer labels readable on the sky', () => {
    const wash = typeWash('transfer', c.primary);
    expect(contrast(wash.accent, wash.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(wash.accent, c.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('graphic contrast', () => {
  it('Trends bar edges stand out from the card', () => {
    expect(contrast(c.textMuted, c.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('avatar initials', () => {
  it.each(AVATAR_COLORS)('ink initials read on %s', (background) => {
    expect(contrast(c.ink, background)).toBeGreaterThanOrEqual(4.5);
  });
});

/** Both colour tables, not only the one the app starts in: text must read on every ground in light and in dark. */
describe.each(['light', 'dark'] as const)('%s palette text contrast', (mode) => {
  const p = PALETTES[mode];
  const grounds = { page: p.background, card: p.surface, surfaceAlt: p.surfaceAlt, tray: p.tray };
  const texts = {
    textPrimary: p.textPrimary,
    textSecondary: p.textSecondary,
    textMuted: p.textMuted,
    expenseText: p.expenseText,
    incomeText: p.incomeText,
    link: p.link,
    warnInk: p.warnInk,
  };
  for (const [tn, text] of Object.entries(texts)) {
    for (const [gn, ground] of Object.entries(grounds)) {
      it(`${tn} reads on ${gn}`, () => {
        expect(contrast(text, ground)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('reads the text on an ink fill (a picked chip) and on the coral Add button', () => {
    expect(contrast(p.onInk, p.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onCoral, p.coral)).toBeGreaterThanOrEqual(4.5);
  });

  it('tells the lines apart from the page without being loud', () => {
    expect(contrast(p.borderSoft, p.background)).toBeGreaterThan(1.05);
    expect(contrast(p.borderSoft, p.background)).toBeLessThan(2);
  });

  it('keeps the moon slices distinct from the page', () => {
    for (const colour of Object.values(p.slice)) {
      expect(contrast(colour, p.background)).toBeGreaterThanOrEqual(1.5);
    }
  });
});
