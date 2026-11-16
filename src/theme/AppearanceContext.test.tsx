import * as ReactNative from 'react-native';
import { create, act } from 'react-test-renderer';

const mockStored = { current: 'system' as 'system' | 'light' | 'dark' };
const mockSetAppearance = jest.fn(async (next: 'system' | 'light' | 'dark') => {
  mockStored.current = next;
});
jest.mock('@/db/settings', () => ({
  getAppearance: jest.fn(async () => mockStored.current),
  getCachedAppearance: () => mockStored.current,
  setAppearance: (next: 'system' | 'light' | 'dark') => mockSetAppearance(next),
}));

import { AppearanceProvider, useAppearance } from './AppearanceContext';
import { SchemeBoundary, schemeScreenLayout } from './SchemeBoundary';
import { applyScheme, getScheme } from './scheme';
import { emitSettingsRestored } from '@/lib/dataEvents';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let phone: 'light' | 'dark' | null = 'light';
beforeEach(() => {
  phone = 'light';
  mockStored.current = 'system';
  mockSetAppearance.mockClear();
  jest.spyOn(ReactNative, 'useColorScheme').mockImplementation(() => phone);
  applyScheme('light');
});
afterEach(() => {
  jest.restoreAllMocks();
  applyScheme('light');
});

function Probe({ onValue }: { onValue: (v: ReturnType<typeof useAppearance>) => void }) {
  onValue(useAppearance());
  return null;
}

describe('AppearanceProvider', () => {
  it('follows the phone by default', async () => {
    phone = 'dark';
    const seen: { value?: ReturnType<typeof useAppearance> } = {};
    await act(async () => {
      create(
        <AppearanceProvider>
          <Probe onValue={(v) => (seen.value = v)} />
        </AppearanceProvider>
      );
      await settle();
    });
    expect(seen.value?.preference).toBe('system');
    expect(seen.value?.scheme).toBe('dark');
    expect(getScheme()).toBe('dark');
  });

  it('has the right mode in place before the first child reads a colour', async () => {
    mockStored.current = 'dark';
    const modeWhenFirstChildRendered: string[] = [];
    function Child() {
      modeWhenFirstChildRendered.push(getScheme());
      return null;
    }
    await act(async () => {
      create(
        <AppearanceProvider>
          <Child />
        </AppearanceProvider>
      );
      await settle();
    });
    expect(modeWhenFirstChildRendered[0]).toBe('dark');
  });

  it('a pick of light or dark wins over the phone, and is saved', async () => {
    phone = 'dark';
    const seen: { value?: ReturnType<typeof useAppearance> } = {};
    await act(async () => {
      create(
        <AppearanceProvider>
          <Probe onValue={(v) => (seen.value = v)} />
        </AppearanceProvider>
      );
      await settle();
    });
    await act(async () => {
      await seen.value?.setPreference('light');
    });
    expect(seen.value?.preference).toBe('light');
    expect(seen.value?.scheme).toBe('light');
    expect(getScheme()).toBe('light');
    expect(mockSetAppearance).toHaveBeenCalledWith('light');
  });

  it('changes mode when the phone does, while following the phone', async () => {
    const seen: { value?: ReturnType<typeof useAppearance> } = {};
    let renderer!: ReturnType<typeof create>;
    const tree = () => (
      <AppearanceProvider>
        <Probe onValue={(v) => (seen.value = v)} />
      </AppearanceProvider>
    );
    await act(async () => {
      renderer = create(tree());
      await settle();
    });
    expect(getScheme()).toBe('light');
    phone = 'dark';
    await act(async () => {
      renderer.update(tree());
      await settle();
    });
    expect(seen.value?.scheme).toBe('dark');
    expect(getScheme()).toBe('dark');
  });

  it('ignores the phone once a mode is picked', async () => {
    mockStored.current = 'light';
    let renderer!: ReturnType<typeof create>;
    const tree = () => (
      <AppearanceProvider>
        <Probe onValue={() => {}} />
      </AppearanceProvider>
    );
    await act(async () => {
      renderer = create(tree());
      await settle();
    });
    phone = 'dark';
    await act(async () => {
      renderer.update(tree());
      await settle();
    });
    expect(getScheme()).toBe('light');
  });

  it('keeps working when saving the preference fails', async () => {
    mockSetAppearance.mockRejectedValueOnce(new Error('disk full'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const seen: { value?: ReturnType<typeof useAppearance> } = {};
    await act(async () => {
      create(
        <AppearanceProvider>
          <Probe onValue={(v) => (seen.value = v)} />
        </AppearanceProvider>
      );
      await settle();
    });
    await act(async () => {
      await seen.value?.setPreference('dark');
    });
    expect(getScheme()).toBe('dark');
    expect(warn).toHaveBeenCalled();
  });

  it('reads the preference again after a restored backup', async () => {
    const seen: { value?: ReturnType<typeof useAppearance> } = {};
    await act(async () => {
      create(
        <AppearanceProvider>
          <Probe onValue={(v) => (seen.value = v)} />
        </AppearanceProvider>
      );
      await settle();
    });
    expect(seen.value?.preference).toBe('system');
    mockStored.current = 'dark';
    await act(async () => {
      emitSettingsRestored();
      await settle();
    });
    expect(seen.value?.preference).toBe('dark');
    expect(getScheme()).toBe('dark');
  });
});

describe('SchemeBoundary', () => {
  it('draws its children again when the mode changes, and only then', async () => {
    let mounts = 0;
    function Child() {
      mounts += 1;
      return null;
    }
    // useRef-free counter: a mount is one render of a freshly created component instance.
    const Tracked = () => {
      const [id] = require('react').useState(() => ++mounts);
      void id;
      return <Child />;
    };
    mounts = 0;
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <SchemeBoundary>
          <Tracked />
        </SchemeBoundary>
      );
    });
    const afterFirst = mounts;
    await act(async () => {
      renderer.update(
        <SchemeBoundary>
          <Tracked />
        </SchemeBoundary>
      );
    });
    // Same mode: the same instance, so only a re-render (one more Child call), not a new mount of Tracked.
    expect(mounts).toBeLessThanOrEqual(afterFirst + 1);
    const before = mounts;
    await act(async () => {
      applyScheme('dark');
    });
    // A new mount creates Tracked's state again: +1 for Tracked and +1 for Child.
    expect(mounts).toBe(before + 2);
  });

  it('is what a navigator screenLayout hands the screen to', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(schemeScreenLayout({ children: <>{'screen'}</> }));
    });
    expect(renderer.toJSON()).toBe('screen');
  });
});
