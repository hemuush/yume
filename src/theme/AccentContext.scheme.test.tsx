import { useEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useAccent } from './AccentContext';
import { PALETTES } from './palette';
import { applyScheme } from './scheme';

let seen: ReturnType<typeof useAccent>;
function Probe() {
  const accent = useAccent();
  useEffect(() => {
    seen = accent;
  }, [accent]);
  return null;
}

const originalDark = PALETTES.dark;
afterEach(() => {
  PALETTES.dark = originalDark;
  applyScheme('light');
});

it('is the sky, mint and coral of the logo, with ink on the sky', async () => {
  applyScheme('light');
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(seen.accent).toBe(PALETTES.light.primary);
  expect(seen.secondary).toBe(PALETTES.light.secondary);
  expect(seen.dot).toBe(PALETTES.light.coral);
  expect(seen.onAccent).toBe(PALETTES.light.ink);
  act(() => tree.unmount());
});

it('is worked out again when the colour mode changes (the text colour on the sky depends on the page colours)', async () => {
  // A dark table with its own ink and surface, so the text colour that suits sky blue is a different value.
  PALETTES.dark = { ...PALETTES.light, ink: '#FFFFFF', surface: '#001100', primary: '#112233' };
  applyScheme('light');
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(seen.onAccent).toBe(PALETTES.light.ink);

  await act(async () => {
    applyScheme('dark');
  });
  expect(seen.accent).toBe('#112233');
  expect(seen.onAccent).toBe('#FFFFFF');

  await act(async () => {
    applyScheme('light');
  });
  expect(seen.accent).toBe(PALETTES.light.primary);
  expect(seen.onAccent).toBe(PALETTES.light.ink);
  act(() => tree.unmount());
});
