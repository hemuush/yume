import { PALETTES, getPalette } from './palette';
import { applyScheme } from './scheme';
import { theme } from '@/constants/theme';

afterEach(() => {
  applyScheme('light');
});

/** Every key path of a palette, nested ones included ("slice.spent"), so two modes can be compared for shape. */
function shape(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      shape(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [prefix];
}

describe('palettes', () => {
  it('give light and dark the same tokens, so a screen never reads a missing one', () => {
    expect(shape(PALETTES.dark)).toEqual(shape(PALETTES.light));
  });

  it('hold only strings (or lists and groups of them)', () => {
    const bad: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'string') return;
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
      if (v && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
      bad.push(path);
    };
    walk(PALETTES.light, 'light');
    walk(PALETTES.dark, 'dark');
    expect(bad).toEqual([]);
  });

  it('follow the mode the app is in', () => {
    expect(getPalette()).toBe(PALETTES.light);
    applyScheme('dark');
    expect(getPalette()).toBe(PALETTES.dark);
  });
});

describe('theme.colors', () => {
  it('reads the palette of the current mode, token by token', () => {
    const lightInk = theme.colors.ink;
    const original = PALETTES.dark;
    PALETTES.dark = {
      ...PALETTES.light,
      ink: '#FF00FF',
      slice: { ...PALETTES.light.slice, spent: '#00FFFF' },
    };
    try {
      expect(theme.colors.ink).toBe(lightInk);
      applyScheme('dark');
      expect(theme.colors.ink).toBe('#FF00FF');
      expect(theme.colors.slice.spent).toBe('#00FFFF');
      applyScheme('light');
      expect(theme.colors.ink).toBe(lightInk);
    } finally {
      PALETTES.dark = original;
    }
  });

  it('lists every token when enumerated, as a plain object would', () => {
    expect(Object.keys(theme.colors)).toEqual(Object.keys(PALETTES.light));
    expect({ ...theme.colors }.ink).toBe(theme.colors.ink);
  });
});
