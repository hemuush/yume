/**
 * Yume's own dialog in place of Android's grey alert: same call as Alert.alert, Cancel on the left,
 * risky button in red, and a button closes the dialog before doing its job.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.unmock('@/components/AppDialog');
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));

import { AppDialogHost, showAlert } from './AppDialog';
import { ModalSheet } from './ModalSheet';

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
  it('consumes a confirmation once even when two taps arrive before rendering', async () => {
    const tree = await render();
    const confirm = jest.fn();
    act(() => showAlert('Continue?', undefined, [{ text: 'Continue', onPress: confirm }]));
    const press = buttons(tree)[0].props.onPress;
    act(() => {
      press();
      press();
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('ignores callbacks from a replaced dialog without dismissing its replacement', async () => {
    const tree = await render();
    const obsolete = jest.fn();
    act(() => showAlert('Old confirmation', undefined, [{ text: 'Old', onPress: obsolete }]));
    const press = buttons(tree)[0].props.onPress;
    act(() => {
      showAlert('New notice');
      press();
    });
    expect(obsolete).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('New notice');
    act(() => tree.unmount());
  });

  it('keeps a follow-up dialog open when the old confirmation receives another tap', async () => {
    const tree = await render();
    const confirm = jest.fn(() => showAlert('Saved'));
    act(() => showAlert('Continue?', undefined, [{ text: 'Continue', onPress: confirm }]));
    const press = buttons(tree)[0].props.onPress;
    act(() => {
      press();
      press();
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(texts(tree)).toContain('Saved');
    act(() => tree.unmount());
  });

  it('ignores a queued action after its host unmounts', async () => {
    const tree = await render();
    const confirm = jest.fn();
    act(() => showAlert('Continue?', undefined, [{ text: 'Continue', onPress: confirm }]));
    const press = buttons(tree)[0].props.onPress;
    act(() => tree.unmount());
    act(() => press());
    expect(confirm).not.toHaveBeenCalled();
  });

  it('runs cancellation only once and ignores a queued confirmation after dismissal', async () => {
    const tree = await render();
    const cancel = jest.fn();
    const confirm = jest.fn();
    act(() =>
      showAlert('Continue?', undefined, [
        { text: 'Cancel', style: 'cancel', onPress: cancel },
        { text: 'Continue', onPress: confirm },
      ])
    );
    const close = tree.root.findByType(ModalSheet).props.onClose;
    const press = buttons(tree)[1].props.onPress;
    act(() => {
      close();
      close();
      press();
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('shows a notice with one OK that closes it', async () => {
    const tree = await render();
    act(() => showAlert("Couldn't save", 'The disk is full.'));
    expect(texts(tree)).toEqual(expect.arrayContaining(["Couldn't save", 'The disk is full.']));
    expect(tree.root.findByType(ModalSheet).props.scrollable).toBe(true);
    expect(tree.root.findByType(ModalSheet).props.footer).toBeDefined();
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
