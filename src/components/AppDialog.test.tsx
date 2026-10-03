/**
 * Yume's own dialog in place of Android's grey alert: same call as Alert.alert, Cancel on the left,
 * risky button in red, and a button closes the dialog before doing its job.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.unmock('@/components/AppDialog');
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) => children,
}));

import { AppDialogHost, showAlert } from './AppDialog';

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const buttons = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => typeof n.props.title === 'string' && typeof n.props.onPress === 'function');

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppDialogHost />);
  });
  return tree;
}

describe('showAlert', () => {
  it('shows a notice with one OK that closes it', async () => {
    const tree = await render();
    act(() => showAlert("Couldn't save", 'The disk is full.'));
    expect(texts(tree)).toEqual(expect.arrayContaining(["Couldn't save", 'The disk is full.']));
    const [ok] = buttons(tree);
    expect(ok.props.title).toBe('OK');
    act(() => ok.props.onPress());
    expect(texts(tree)).toEqual([]);
  });

  it('puts Cancel first, makes Delete red, and runs it after closing', async () => {
    const tree = await render();
    const onDelete = jest.fn();
    act(() =>
      showAlert('Delete this?', undefined, [
        { text: 'Delete', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ])
    );
    const [first, second] = buttons(tree);
    expect([first.props.title, first.props.variant]).toEqual(['Cancel', 'secondary']);
    expect([second.props.title, second.props.variant]).toEqual(['Delete', 'danger']);
    act(() => second.props.onPress());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(buttons(tree)).toHaveLength(0);
  });
});
