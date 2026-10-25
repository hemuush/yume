import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react-native').ScrollView,
}));
jest.mock('@/components/AmountField', () => ({
  AmountPadDock: ({ children }: { children: (props: object) => unknown }) =>
    children({ onScroll: jest.fn() }),
}));
jest.mock('@/lib/useCollapsingHeader', () => ({ useCollapsingHeader: () => ({ headerHeight: 0 }) }));
jest.mock('@/features/home/SkyHeader', () => ({ SkyHeader: () => null }));
jest.mock('@/features/home/HomeWallpaper', () => ({ HomeWallpaper: () => null }));
jest.mock('./YouSection', () => ({ YouSection: () => null }));
jest.mock('./SettingsSection', () => ({ SettingsSection: () => null }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}) }));
jest.mock('@/lib/useScreenLoad', () => ({
  useScreenLoad: (load: () => Promise<void>) => {
    require('react').useEffect(() => {
      void load();
    }, [load]);
    return { loaded: true, hasData: true, loadError: null, reload: load };
  },
}));
const mockSetName = jest.fn(async (_name: string) => {});
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getUserName: async () => 'Hemant',
  getMemberSinceYear: async () => 2024,
  setUserName: (name: string) => mockSetName(name),
}));

import ProfileScreen from '../../../app/profile';
import { ProfileIdentity } from './ProfileIdentity';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SettingsSection } from './SettingsSection';
import { showAlert } from '@/components/AppDialog';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ProfileScreen />);
  });
  return tree;
}
const identity = (tree: ReactTestRenderer) => tree.root.findByType(ProfileIdentity);
const input = (tree: ReactTestRenderer) => tree.root.findByType(TextInput);

it('edits and cancels a name without changing the saved identity', async () => {
  const tree = await render();
  act(() => identity(tree).props.onStartEdit());
  expect(input(tree).props.value).toBe('Hemant');
  act(() => input(tree).props.onChangeText('Mira'));
  act(() => identity(tree).props.onCancel());
  expect(identity(tree).props.name).toBe('Hemant');
  expect(identity(tree).props.editing).toBe(false);
  expect(mockSetName).not.toHaveBeenCalled();
});

it('saves once while busy and updates the visible identity on success', async () => {
  let finish!: () => void;
  mockSetName.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const tree = await render();
  act(() => identity(tree).props.onStartEdit());
  act(() => input(tree).props.onChangeText('Mira'));
  act(() => {
    identity(tree).props.onSave();
    identity(tree).props.onSave();
  });
  expect(mockSetName).toHaveBeenCalledTimes(1);
  expect(input(tree).props.editable).toBe(false);
  await act(async () => {
    finish();
  });
  expect(identity(tree).props.name).toBe('Mira');
  expect(identity(tree).props.editing).toBe(false);
});

it('keeps a failed name draft available to retry and switches to Settings', async () => {
  mockSetName.mockRejectedValueOnce(new Error('write failed'));
  const tree = await render();
  act(() => identity(tree).props.onStartEdit());
  act(() => input(tree).props.onChangeText('Mira'));
  await act(async () => {
    await identity(tree).props.onSave();
  });
  expect(showAlert).toHaveBeenCalledWith("Couldn't save name", 'write failed');
  expect(input(tree).props.value).toBe('Mira');
  expect(input(tree).props.editable).toBe(true);
  act(() => tree.root.findByType(SegmentedControl).props.onChange('settings'));
  expect(tree.root.findAllByType(SettingsSection)).toHaveLength(1);
});
