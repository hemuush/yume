import { interactionColors, selectedFill, themeInk } from './interactionColors';
import { PALETTES } from './palette';
import { applyScheme } from './scheme';
import { theme } from '@/constants/theme';
import { contrastRatio as contrast } from '@/lib/color';

afterEach(() => applyScheme('light'));

it('gives the dark selected fill a visible lift and readable label', () => {
  applyScheme('dark');
  const fill = selectedFill(theme.colors.primary);
  expect(fill).toBe(theme.colors.home.selected);
  expect(contrast(fill, theme.colors.surface)).toBeGreaterThanOrEqual(1.7);
  expect(contrast(theme.colors.ink, fill)).toBeGreaterThanOrEqual(4.5);
});

describe.each(['light', 'dark'] as const)('in %s', (mode) => {
  beforeEach(() => applyScheme(mode));

  it('keeps small selected labels readable on the sky of the logo', () => {
    const colors = interactionColors(PALETTES[mode].primary);
    expect(contrast(colors.ink, theme.colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.ink, colors.tint)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'])(
    'retains readable controls for the accent %s',
    (accent) => expect(contrast(themeInk(accent), theme.colors.surface)).toBeGreaterThanOrEqual(4.5)
  );
});
