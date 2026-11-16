import { interactionColors, themeInk } from './interactionColors';
import { PALETTES } from './palette';
import { applyScheme } from './scheme';
import { theme } from '@/constants/theme';

function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((part) => {
      const value = parseInt(part, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

afterEach(() => applyScheme('light'));

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
