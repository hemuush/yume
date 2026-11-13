/** A panel that opens and closes by gliding its own height, so the rows below move with it. */
import { StyleSheet, Text, View } from 'react-native';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
const mockReduce = jest.fn(() => false);
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce() }));

import { Collapsible } from './Collapsible';

function outerPanel(tree: ReactTestRenderer) {
  return tree.root.findAll((n) => n.type === View && n.props.pointerEvents !== undefined)[0];
}
function panel(tree: ReactTestRenderer) {
  const outer = outerPanel(tree);
  return outer ? StyleSheet.flatten(outer.props.style) : undefined;
}
function measure(tree: ReactTestRenderer, height: number) {
  const inner = tree.root.findAll((n) => n.type === View && typeof n.props.onLayout === 'function')[0];
  act(() => inner.props.onLayout({ nativeEvent: { layout: { height } } }));
}
function show(open: boolean, tree?: ReactTestRenderer) {
  const element = (
    <Collapsible open={open}>
      <Text>Phone Cover</Text>
    </Collapsible>
  );
  if (tree) {
    act(() => tree.update(element));
    return tree;
  }
  let created!: ReactTestRenderer;
  act(() => {
    created = create(element);
  });
  return created;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockReduce.mockReturnValue(false);
});
afterEach(() => jest.useRealTimers());

it('is simply open when first shown open, with no glide, and absent when first shown closed', () => {
  const open = show(true);
  expect(panel(open)?.height).toBeUndefined();
  expect(panel(open)?.transitionDuration).toBe('0ms');
  act(() => open.unmount());
  const closed = show(false);
  expect(panel(closed)).toBeUndefined();
  expect(closed.root.findAllByType(Text)).toHaveLength(0);
  act(() => closed.unmount());
});

it('opens from nothing: starts at no height, then glides to the measured height as it fades in', () => {
  const tree = show(false);
  show(true, tree);
  expect(panel(tree)).toMatchObject({ height: 0, opacity: 0, transitionDuration: '200ms' });
  expect(panel(tree)?.transitionProperty).toEqual(['height', 'opacity']);
  measure(tree, 96);
  expect(panel(tree)).toMatchObject({ height: 96, opacity: 1, overflow: 'hidden' });
  act(() => tree.unmount());
});

it('schedules nothing for a panel that is closed and has never opened, so a later opening is not undone', () => {
  // A close timer here would write "gone" into a panel that is already gone, and in a long list that late write
  // landed after the next opening and removed the panel just opened.
  const tree = show(false);
  expect(jest.getTimerCount()).toBe(0);
  show(true, tree);
  measure(tree, 96);
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(panel(tree)).toMatchObject({ height: 96, opacity: 1 });
  act(() => tree.unmount());
});

it('closes by gliding to nothing, then leaves the tree, and the next opening grows from nothing again', () => {
  const tree = show(true);
  measure(tree, 96);
  show(false, tree);
  expect(panel(tree)).toMatchObject({ height: 0, opacity: 0 });
  // While it closes it can't be tapped or read out.
  expect(outerPanel(tree).props.pointerEvents).toBe('none');
  expect(outerPanel(tree).props.importantForAccessibility).toBe('no-hide-descendants');
  expect(tree.root.findAllByType(Text)).toHaveLength(1);
  act(() => {
    jest.advanceTimersByTime(260);
  });
  expect(panel(tree)).toBeUndefined();
  show(true, tree);
  expect(panel(tree)).toMatchObject({ height: 0, opacity: 0 });
  act(() => tree.unmount());
});

it('reopening while it is still closing keeps it, and never removes it afterwards', () => {
  const tree = show(true);
  measure(tree, 96);
  show(false, tree);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  show(true, tree);
  act(() => {
    jest.advanceTimersByTime(500);
  });
  expect(panel(tree)).toMatchObject({ height: 96, opacity: 1 });
  act(() => tree.unmount());
});

it('jumps with reduce motion: gone at once when closed, no glide when open', () => {
  mockReduce.mockReturnValue(true);
  const tree = show(true);
  measure(tree, 96);
  show(false, tree);
  // With reduce motion there is nothing to wait for: it is gone at once, and while it lived it did not glide.
  expect(panel(tree)).toBeUndefined();
  show(true, tree);
  expect(panel(tree)?.transitionDuration).toBe('0ms');
  act(() => tree.unmount());
});
