import { PALETTES } from './palette';
import { SUMMARY_INK, LIGHT_GRADIENT, DARK_GRADIENT } from '@/components/SummaryGradient';
import { contrastRatio as contrast } from '@/lib/color';

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

// The blue summary card (Home, Reports, Debt): its text roles sit on a gradient, so each must read on all three of its
// stops, not only the middle one.
describe.each([
  ['light', SUMMARY_INK.light, LIGHT_GRADIENT],
  ['dark', SUMMARY_INK.dark, DARK_GRADIENT],
] as const)('the summary card in %s mode', (_mode, ink, stops) => {
  it.each(['text', 'secondary', 'positive', 'negative', 'link'] as const)(
    'keeps %s readable on every stop',
    (role) => {
      for (const stop of stops) {
        expect({ role, stop, ok: contrast(ink[role], stop) >= 4.5 }).toEqual({ role, stop, ok: true });
      }
    }
  );
});
