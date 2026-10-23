import { useEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AccentProvider, useAccent } from './AccentContext';
import { getAccentColor, getThemeId, setThemeSelection } from '@/db/settings';
import { emitSettingsRestored } from '@/lib/dataEvents';
import { themeById } from './themes';

jest.mock('@/db/settings', () => ({
  getAccentColor: jest.fn(),
  getThemeId: jest.fn(),
  getCachedAccentColor: () => '#8FCBFF',
  setThemeSelection: jest.fn(async () => {}),
}));
let value!: ReturnType<typeof useAccent>;
let tree: ReactTestRenderer;
function Probe() {
  const current = useAccent();
  useEffect(() => {
    value = current;
  }, [current]);
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function mount() {
  await act(async () => {
    tree = create(
      <AccentProvider>
        <Probe />
      </AccentProvider>
    );
  });
}
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  act(() => tree?.unmount());
});

it('does not replace a newly selected theme with a slow startup read', async () => {
  const initial = deferred<string>();
  jest.mocked(getThemeId).mockResolvedValue('yume');
  jest.mocked(getAccentColor).mockReturnValue(initial.promise);
  await mount();
  act(() => value.setTheme('hollowViolet'));
  await act(async () => {
    initial.resolve('#8FCBFF');
  });
  expect(value.themeId).toBe('hollowViolet');
  expect(value.accent).toBe(themeById('hollowViolet')!.primary);
  expect(setThemeSelection).toHaveBeenCalledWith('hollowViolet', themeById('hollowViolet')!.primary);
});

it('keeps the newest restored theme when older reads finish later', async () => {
  const initial = deferred<string>();
  jest.mocked(getThemeId).mockResolvedValueOnce('yume').mockResolvedValueOnce('corpsGreen');
  jest
    .mocked(getAccentColor)
    .mockReturnValueOnce(initial.promise)
    .mockResolvedValueOnce(themeById('corpsGreen')!.primary);
  await mount();
  await act(async () => {
    emitSettingsRestored();
  });
  await act(async () => {
    initial.resolve('#8FCBFF');
  });
  expect(value.themeId).toBe('corpsGreen');
  expect(value.accent).toBe(themeById('corpsGreen')!.primary);
});
