/** Profile: how + adds an entry. Starts from what is saved, saves a change, and puts it back if saving fails. */
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock('@/db/settings', () => ({ getAddStyle: () => mockGet(), setAddStyle: (s: string) => mockSet(s) }));
const mockAlert = jest.fn();
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
jest.mock('@/components/ToggleSwitch', () => ({
  ToggleSwitch: (p: { value: boolean; onChange: (v: boolean) => void; accessibilityLabel: string }) => {
    const { Pressable: P } = require('react-native');
    return (
      <P
        accessibilityLabel={p.accessibilityLabel}
        accessibilityState={{ checked: p.value }}
        onPress={() => p.onChange(!p.value)}
      />
    );
  },
}));

import { AddStyleSetting } from './AddStyleSetting';

const isOn = (tree: ReactTestRenderer) =>
  tree.root.find((n) => n.props.accessibilityLabel === 'Add by chat' && n.props.accessibilityState).props
    .accessibilityState.checked;
const tap = (tree: ReactTestRenderer) =>
  act(async () =>
    tree.root.find((n) => n.props.accessibilityLabel === 'Add by chat' && n.props.onPress).props.onPress()
  );
const hint = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
async function open() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AddStyleSetting />);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue('form');
  mockSet.mockResolvedValue(undefined);
});

it('starts from the saved choice', async () => {
  mockGet.mockResolvedValue('chat');
  const tree = await open();
  expect(isOn(tree)).toBe(true);
  expect(hint(tree).some((t) => t.includes('Suu asks one thing at a time'))).toBe(true);
});

it('saves the other choice when it is switched', async () => {
  const tree = await open();
  expect(isOn(tree)).toBe(false);
  await tap(tree);
  expect(mockSet).toHaveBeenCalledWith('chat');
  expect(isOn(tree)).toBe(true);
});

it('goes back to the old choice, and says so, when saving fails', async () => {
  mockSet.mockRejectedValue(new Error('disk full'));
  const tree = await open();
  await tap(tree);
  expect(isOn(tree)).toBe(false);
  expect(mockAlert).toHaveBeenCalledWith('Couldn’t save', 'disk full');
});
