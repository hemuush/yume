/** The action menu sheet: rows in order, and closing before the tapped action runs. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('./ModalSheet', () => ({
  ModalSheet: ({
    visible,
    title,
    subtitle,
    children,
  }: {
    visible: boolean;
    title?: string;
    subtitle?: string;
    children: unknown;
  }) =>
    visible
      ? require('react').createElement(
          require('react-native').View,
          { testID: 'sheet', title, subtitle },
          children
        )
      : null,
}));

import { ActionSheet, type ActionSheetItem } from './ActionSheet';

const mounted: ReactTestRenderer[] = [];
const labels = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const rowFor = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(
    (n) =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function' &&
      n.findAllByType(Text).some((x) => [].concat(x.props.children).join('') === label)
  )[0];

function render(items: ActionSheetItem[], visible = true) {
  const onClose = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ActionSheet visible={visible} onClose={onClose} title="Entry" subtitle="Test Person" items={items} />
    );
  });
  mounted.push(tree);
  return { tree, onClose };
}

afterEach(() => act(() => mounted.splice(0).forEach((t) => t.unmount())));

describe('ActionSheet', () => {
  it('lists every action in the order given and passes the title through', () => {
    const { tree } = render([
      { key: 'a', label: 'Edit', icon: 'edit-2', onPress: jest.fn() },
      { key: 'b', label: 'Share', onPress: jest.fn() },
      { key: 'c', label: 'Delete', icon: 'trash-2', destructive: true, onPress: jest.fn() },
    ]);
    expect(labels(tree)).toEqual(['Edit', 'Share', 'Delete']);
    const sheet = tree.root.findByProps({ testID: 'sheet' });
    expect(sheet.props.title).toBe('Entry');
    expect(sheet.props.subtitle).toBe('Test Person');
  });

  it('closes the sheet and then runs the tapped action, once', () => {
    const order: string[] = [];
    const onPress = jest.fn(() => order.push('action'));
    const { tree, onClose } = render([{ key: 'a', label: 'Edit', onPress }]);
    onClose.mockImplementation(() => order.push('close'));
    act(() => rowFor(tree, 'Edit').props.onPress());
    expect(order).toEqual(['close', 'action']);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('only runs the action that was tapped', () => {
    const edit = jest.fn();
    const del = jest.fn();
    const { tree } = render([
      { key: 'a', label: 'Edit', onPress: edit },
      { key: 'b', label: 'Delete', destructive: true, onPress: del },
    ]);
    act(() => rowFor(tree, 'Delete').props.onPress());
    expect(del).toHaveBeenCalledTimes(1);
    expect(edit).not.toHaveBeenCalled();
  });

  it('shows nothing while it is not visible', () => {
    const { tree } = render([{ key: 'a', label: 'Edit', onPress: jest.fn() }], false);
    expect(labels(tree)).toEqual([]);
  });
});
