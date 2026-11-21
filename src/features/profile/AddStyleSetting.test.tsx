/** Profile: how + adds an entry. Starts from what is saved, saves a change, and puts it back if saving fails. */
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock('@/db/settings', () => ({ getAddStyle: () => mockGet(), setAddStyle: (s: string) => mockSet(s) }));
const mockAlert = jest.fn();
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
// A plain stand-in for the pill switch: one pressable per option, selected one marked.
jest.mock('@/components/SegmentedControl', () => ({
  SegmentedControl: ({
    options,
    value,
    onChange,
  }: {
    options: { label: string; value: string }[];
    value: string;
    onChange: (v: string) => void;
  }) => {
    const { Pressable: P, Text: T } = require('react-native');
    return options.map((o) => (
      <P
        key={o.value}
        accessibilityLabel={o.label}
        accessibilityState={{ selected: value === o.value }}
        onPress={() => onChange(o.value)}
      >
        <T>{o.label}</T>
      </P>
    ));
  },
}));

import { AddStyleSetting } from './AddStyleSetting';

const selected = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) => n.props.accessibilityState?.selected === true && typeof n.props.onPress === 'function'
  )[0]?.props.accessibilityLabel;
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
  expect(selected(tree)).toBe('Chat');
  expect(hint(tree).some((t) => t.includes('Suu asks one thing at a time'))).toBe(true);
});

it('saves the other choice when it is tapped', async () => {
  const tree = await open();
  expect(selected(tree)).toBe('Form');
  await act(async () =>
    tree.root.find((n) => n.props.accessibilityLabel === 'Chat' && n.props.onPress).props.onPress()
  );
  expect(mockSet).toHaveBeenCalledWith('chat');
  expect(selected(tree)).toBe('Chat');
});

it('goes back to the old choice, and says so, when saving fails', async () => {
  mockSet.mockRejectedValue(new Error('disk full'));
  const tree = await open();
  await act(async () =>
    tree.root.find((n) => n.props.accessibilityLabel === 'Chat' && n.props.onPress).props.onPress()
  );
  expect(selected(tree)).toBe('Form');
  expect(mockAlert).toHaveBeenCalledWith('Couldn’t save', 'disk full');
});
