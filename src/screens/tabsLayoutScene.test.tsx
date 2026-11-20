/** The tab navigator paints its own scene colour, so a cross-fade never shows the navigator's light default. */
import { act, create } from 'react-test-renderer';

let mockOptions: { sceneStyle?: { backgroundColor?: string } } = {};
jest.mock('expo-router', () => {
  function Tabs({ screenOptions }: { screenOptions: typeof mockOptions }) {
    mockOptions = screenOptions;
    return null;
  }
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs };
});
jest.mock('@/components/PillTabBar', () => ({ PillTabBar: () => null }));
jest.mock('@/features/home/RepeatEntrySheet', () => ({ RepeatEntrySheet: () => null }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => false }));

import TabsLayout from '../../app/(tabs)/_layout';
import { applyScheme } from '@/theme/scheme';
import { PALETTES } from '@/theme/palette';

afterEach(() => applyScheme('light'));

it.each(['light', 'dark'] as const)('paints the %s page colour behind the tabs', (scheme) => {
  applyScheme(scheme);
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<TabsLayout />);
  });
  expect(mockOptions.sceneStyle?.backgroundColor).toBe(PALETTES[scheme].background);
  act(() => tree.unmount());
});

it('follows a switch of mode while mounted', () => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<TabsLayout />);
  });
  act(() => {
    applyScheme('dark');
  });
  expect(mockOptions.sceneStyle?.backgroundColor).toBe(PALETTES.dark.background);
  act(() => tree.unmount());
});
