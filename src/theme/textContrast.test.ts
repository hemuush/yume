import { PALETTES } from './palette';
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
