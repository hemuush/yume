/**
 * The undo toast: it speaks for TalkBack (it never takes focus), its Undo link is a labelled button that
 * runs the undo and closes the toast, and a delete landing mid-toast queues behind it.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { UndoToastProvider, useUndoToast } from './UndoToast';

jest.useFakeTimers();

let show!: (message: string, onUndo: () => void) => void;
function Probe() {
  const ctx = useUndoToast();
  useEffect(() => {
    show = ctx.show;
  }, [ctx]);
  return null;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const undoButton = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === 'Undo' && typeof n.props.onPress === 'function')[0];

let announce: jest.SpyInstance;
beforeEach(() => {
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => announce.mockRestore());

function render() {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <UndoToastProvider>
        <Probe />
      </UndoToastProvider>
    );
  });
  return tree;
}

describe('UndoToast', () => {
  it('announces the message for TalkBack when it appears', () => {
    const tree = render();
    expect(announce).not.toHaveBeenCalled();
    act(() => show('Deleted Lunch', jest.fn()));
    expect(texts(tree)).toContain('Deleted Lunch');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Deleted Lunch. Undo available.');
  });

  it('has an Undo button that runs the undo once and closes the toast', () => {
    const tree = render();
    const onUndo = jest.fn();
    act(() => show('Deleted Lunch', onUndo));
    const undo = undoButton(tree)!;
    expect(undo.props.accessibilityRole).toBe('button');
    act(() => undo.props.onPress());
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(texts(tree)).not.toContain('Deleted Lunch');
  });

  it('gives the Undo link a touch target past its ~18dp word', () => {
    const tree = render();
    act(() => show('Deleted Lunch', jest.fn()));
    const { top, bottom } = undoButton(tree)!.props.hitSlop;
    expect(top + bottom + 18).toBeGreaterThanOrEqual(48);
  });

  it('queues a second delete, announcing it only when its turn comes', () => {
    const tree = render();
    act(() => show('Deleted A', jest.fn()));
    act(() => show('Deleted B', jest.fn()));
    expect(texts(tree).join(' ')).toContain('+1 more');
    expect(announce).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(4000));
    expect(texts(tree)).toContain('Deleted B');
    expect(announce).toHaveBeenLastCalledWith('Deleted B. Undo available.');
  });

  it('closes itself after a few seconds', () => {
    const tree = render();
    act(() => show('Deleted Lunch', jest.fn()));
    act(() => jest.advanceTimersByTime(4000));
    expect(texts(tree)).not.toContain('Deleted Lunch');
  });
});
