import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { HeaderUserButton } from './AppHeader';
import { getCachedUserName, getUserName } from '@/db/settings';
import { emitSettingsRestored } from '@/lib/dataEvents';

jest.mock('@/db/settings', () => ({ getCachedUserName: jest.fn(), getUserName: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/lib/useReturnOrPush', () => ({ useReturnOrPush: () => jest.fn() }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF', onAccent: '#12130F' }) }));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@expo/vector-icons/Feather', () => () => null);

const cached = getCachedUserName as jest.Mock;
const load = getUserName as jest.Mock;
let tree: ReactTestRenderer;
const initials = () => tree.root.findAllByType(Text).map((node) => node.props.children);
const render = async () => {
  await act(async () => {
    tree = create(<HeaderUserButton />);
  });
};
afterEach(() => {
  act(() => tree?.unmount());
  jest.resetAllMocks();
});

it('loads the saved initial on a cold start without navigating away', async () => {
  cached.mockReturnValue(null);
  let resolve!: (name: string) => void;
  load.mockReturnValue(
    new Promise<string>((finish) => {
      resolve = finish;
    })
  );
  await render();
  expect(initials()).toEqual([]);
  await act(async () => resolve('  Hemant  '));
  expect(initials()).toEqual(['H']);
});

it('uses the cached initial immediately and keeps it after a read failure', async () => {
  cached.mockReturnValue('Bina');
  load.mockRejectedValue(new Error('busy'));
  await render();
  expect(initials()).toEqual(['B']);
});

it('updates restored names and ignores an older pending read', async () => {
  cached.mockReturnValue(null);
  let old!: (name: string) => void;
  load
    .mockReturnValueOnce(
      new Promise<string>((resolve) => {
        old = resolve;
      })
    )
    .mockResolvedValueOnce('Chitra');
  await render();
  await act(async () => emitSettingsRestored());
  expect(initials()).toEqual(['C']);
  await act(async () => old('Hemant'));
  expect(initials()).toEqual(['C']);
});

it('unsubscribes from restored settings on unmount', async () => {
  cached.mockReturnValue(null);
  load.mockResolvedValue(null);
  await render();
  act(() => tree.unmount());
  await act(async () => emitSettingsRestored());
  expect(load).toHaveBeenCalledTimes(1);
});
