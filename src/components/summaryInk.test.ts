import { DARK_GRADIENT, LIGHT_GRADIENT, summaryInk } from './SummaryGradient';
import { applyScheme } from '@/theme/scheme';
import { theme } from '@/constants/theme';
import { contrastRatio as contrast } from '@/lib/color';

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
