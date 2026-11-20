import { DARK_GRADIENT, LIGHT_GRADIENT, summaryInk } from './SummaryGradient';
import { applyScheme } from '@/theme/scheme';
import { theme } from '@/constants/theme';

function luminance(hex: string) {
  const rgb = hex
    .slice(1, 7)
    .match(/../g)!
    .map((part) => {
      const value = parseInt(part, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

afterEach(() => applyScheme('light'));

describe.each([
  ['light', LIGHT_GRADIENT],
  ['dark', DARK_GRADIENT],
] as const)('summary card ink in %s mode', (scheme, stops) => {
  it.each(['text', 'secondary', 'positive', 'negative', 'link'] as const)(
    'keeps %s readable on every part of the gradient',
    (role) => {
      applyScheme(scheme);
      for (const stop of stops) expect(contrast(summaryInk[role], stop)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('keeps the label on the action fill readable', () => {
    applyScheme(scheme);
    expect(contrast(theme.colors.onInk, theme.colors.action)).toBeGreaterThanOrEqual(4.5);
  });
});
