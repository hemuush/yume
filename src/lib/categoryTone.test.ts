/** A category's icon tile: a wash of its own colour with a deep glyph on it, readable for every colour offered, in both modes. */
import { CATEGORY_COLOR_PALETTE } from '@/constants/theme';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { applyScheme } from '@/theme/scheme';
import { contrastRatio } from './color';
import { categoryTone } from './categoryTone';

const colours = [...new Set([...CATEGORY_COLOR_PALETTE, ...DEFAULT_CATEGORIES.map((c) => c.color)])];

afterEach(() => applyScheme('light'));

describe.each(['light', 'dark'] as const)('in %s mode', (mode) => {
  it('keeps the glyph readable on its tile for every colour a category can have', () => {
    applyScheme(mode);
    for (const color of colours) {
      const tone = categoryTone(color)!;
      expect({ color, ok: contrastRatio(tone.glyph, tone.fill) >= 4.5 }).toEqual({ color, ok: true });
    }
  });
});

it('is a pale wash in light mode and a deep one in dark', () => {
  applyScheme('light');
  const light = categoryTone('#FF9E7D')!;
  applyScheme('dark');
  const dark = categoryTone('#FF9E7D')!;
  expect(light.fill).not.toBe(dark.fill);
});

it('leaves a colour that is not hex, or none, to the neutral tile', () => {
  expect(categoryTone('rebeccapurple')).toBeNull();
  expect(categoryTone('')).toBeNull();
  expect(categoryTone(undefined)).toBeNull();
  expect(categoryTone('#12')).toBeNull();
});
