import { useEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AccentProvider, useAccent } from './AccentContext';
import { PALETTES } from './palette';
import { applyScheme } from './scheme';

jest.mock('@/db/settings', () => ({
  getAccentColor: jest.fn(async () => '#8FCBFF'),
  getThemeId: jest.fn(async () => null),
  getCachedAccentColor: () => '#8FCBFF',
  setThemeSelection: jest.fn(async () => {}),
}));

let onAccent = '';
function Probe() {
  const accent = useAccent();
  useEffect(() => {
    onAccent = accent.onAccent;
  }, [accent]);
  return null;
}

const originalDark = PALETTES.dark;
afterEach(() => {
  PALETTES.dark = originalDark;
  applyScheme('light');
});

it('works out the text colour on the accent again when the colour mode changes', async () => {
  // A dark table with its own ink and surface, so the text colour that suits sky blue is a different value.
  PALETTES.dark = { ...PALETTES.light, ink: '#FFFFFF', surface: '#001100' };
  applyScheme('light');
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AccentProvider>
        <Probe />
      </AccentProvider>
    );
  });
  expect(onAccent).toBe(PALETTES.light.ink);

  await act(async () => {
    applyScheme('dark');
  });
  expect(onAccent).toBe('#001100');

  await act(async () => {
    applyScheme('light');
  });
  expect(onAccent).toBe(PALETTES.light.ink);
  act(() => tree.unmount());
});
