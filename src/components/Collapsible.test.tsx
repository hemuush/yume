/** A panel that opens and closes by gliding its own height, so the rows below move with it. */
import { StyleSheet, Text, View } from 'react-native';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
const mockReduce = jest.fn(() => false);
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce() }));

import { Collapsible, panelStyle } from './Collapsible';

function outerPanel(tree: ReactTestRenderer) {
  return tree.root.findAll((n) => n.type === View && n.props.pointerEvents !== undefined)[0];
}
function panel(tree: ReactTestRenderer) {
  const outer = outerPanel(tree);
  return outer ? StyleSheet.flatten(outer.props.style) : undefined;
}
function measure(tree: ReactTestRenderer, height: number) {
  // The panel and, inside it, the entries both report a layout: the entries' is the last.
  const inner = tree.root.findAll((n) => n.type === View && typeof n.props.onLayout === 'function').at(-1)!;
  act(() => inner.props.onLayout({ nativeEvent: { layout: { height } } }));
}
function element(open: boolean, warm = false) {
  return (
    <Collapsible open={open} warm={warm}>
      <Text>Phone Cover</Text>
    </Collapsible>
  );
}
function show(open: boolean, tree?: ReactTestRenderer, warm = false) {
  if (tree) {
    act(() => tree.update(element(open, warm)));
    return tree;
  }
  let created!: ReactTestRenderer;
  act(() => {
    created = create(element(open, warm));
  });
  return created;
}
// The test double for Reanimated draws a style when the component renders, so a render shows what the UI thread would.
const redraw = (tree: ReactTestRenderer, open: boolean, warm = false) =>
  act(() => tree.update(element(open, warm)));

beforeEach(() => {
  jest.useFakeTimers();
  mockReduce.mockReturnValue(false);
});
afterEach(() => jest.useRealTimers());

describe('panelStyle', () => {
  it('is as tall as the content once measured, in step with how open it is', () => {
    expect(panelStyle(96, 0)).toEqual({ height: 0, opacity: 0 });
    expect(panelStyle(96, 0.5)).toEqual({ height: 48, opacity: 0.5 });
    expect(panelStyle(96, 1)).toEqual({ height: 96, opacity: 1 });
  });

  it('hides an unmeasured panel while it opens, and shows it as it is once open (a failed measure still shows the entries)', () => {
    expect(panelStyle(0, 0)).toEqual({ height: 0, opacity: 0 });
    expect(panelStyle(0, 0.6)).toEqual({ height: 0, opacity: 0 });
    expect(panelStyle(0, 1)).toEqual({ height: 'auto', opacity: 1 });
  });
});

it('is simply open when first shown open, and absent when first shown closed', () => {
  const open = show(true);
  expect(panel(open)).toMatchObject({ height: 'auto', opacity: 1, overflow: 'hidden' });
  expect(open.root.findAllByType(Text)).toHaveLength(1);
  act(() => open.unmount());
  const closed = show(false);
  expect(panel(closed)).toBeUndefined();
  expect(closed.root.findAllByType(Text)).toHaveLength(0);
  act(() => closed.unmount());
});

it('schedules nothing for a panel that is closed and has never opened, so a later opening is not undone', () => {
  // A close timer here once wrote "gone" into a panel that was already gone, and in a long list it landed after
  // the next opening and removed the panel just opened.
  const tree = show(false);
  expect(jest.getTimerCount()).toBe(0);
  show(true, tree);
  measure(tree, 96);
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(tree.root.findAllByType(Text)).toHaveLength(1);
  redraw(tree, true);
  expect(panel(tree)).toMatchObject({ height: 96, opacity: 1 });
  act(() => tree.unmount());
});

it('opens by putting its entries in the tree, measures them, and is as tall as they are', () => {
  const tree = show(false);
  show(true, tree);
  expect(tree.root.findAllByType(Text)).toHaveLength(1);
  measure(tree, 96);
  redraw(tree, true);
  expect(panel(tree)).toMatchObject({ height: 96, opacity: 1, overflow: 'hidden' });
  expect(outerPanel(tree).props.pointerEvents).toBe('auto');
  act(() => tree.unmount());
});

it('closes to nothing, cannot be tapped or read while it does, then leaves the tree, and opens again', () => {
  const tree = show(true);
  measure(tree, 96);
  show(false, tree);
  redraw(tree, false);
  expect(panel(tree)).toMatchObject({ height: 0, opacity: 0 });
  expect(outerPanel(tree).props.pointerEvents).toBe('none');
  expect(outerPanel(tree).props.importantForAccessibility).toBe('no-hide-descendants');
  expect(tree.root.findAllByType(Text)).toHaveLength(1);
  act(() => {
    jest.advanceTimersByTime(260);
  });
  expect(panel(tree)).toBeUndefined();
  show(true, tree);
  expect(tree.root.findAllByType(Text)).toHaveLength(1);
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
  expect(tree.root.findAllByType(Text)).toHaveLength(1);
  redraw(tree, true);
  expect(panel(tree)).toMatchObject({ height: 96, opacity: 1 });
  act(() => tree.unmount());
});

it('jumps with reduce motion: gone at once when closed', () => {
  mockReduce.mockReturnValue(true);
  const tree = show(true);
  measure(tree, 96);
  show(false, tree);
  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(panel(tree)).toBeUndefined();
  show(true, tree);
  expect(tree.root.findAllByType(Text)).toHaveLength(1);
  act(() => tree.unmount());
});

describe('when the animation does not take', () => {
  const outerLayout = (tree: ReactTestRenderer, height: number) =>
    act(() => outerPanel(tree).props.onLayout({ nativeEvent: { layout: { height } } }));

  it('shows the entries as plain rows if the panel stays shorter than they are', () => {
    const tree = show(false);
    show(true, tree);
    measure(tree, 96);
    outerLayout(tree, 0);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(outerPanel(tree)).toBeUndefined();
    expect(tree.root.findAllByType(Text)).toHaveLength(1);
    // Still there after closing and opening again.
    show(false, tree);
    show(true, tree);
    expect(tree.root.findAllByType(Text)).toHaveLength(1);
    act(() => tree.unmount());
  });

  it('keeps animating when the panel reaches the height of the entries', () => {
    const tree = show(false);
    show(true, tree);
    measure(tree, 96);
    outerLayout(tree, 96);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(outerPanel(tree)).toBeDefined();
    act(() => tree.unmount());
  });

  it('does not judge a panel that has not reported a height', () => {
    const tree = show(false);
    show(true, tree);
    measure(tree, 96);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(outerPanel(tree)).toBeDefined();
    act(() => tree.unmount());
  });
});

describe('opening without a hitch', () => {
  it('waits for the entries to be measured before it starts to open, then opens from the start', () => {
    const tree = show(false);
    show(true, tree);
    redraw(tree, true);
    // In the tree already (the same render as the tap), hidden and not yet gliding.
    expect(tree.root.findAllByType(Text)).toHaveLength(1);
    expect(panel(tree)).toMatchObject({ height: 0, opacity: 0 });
    measure(tree, 96);
    redraw(tree, true);
    expect(panel(tree)).toMatchObject({ height: 96, opacity: 1 });
    act(() => tree.unmount());
  });

  it('opens anyway, as tall as its entries, if the measure never comes', () => {
    const tree = show(false);
    show(true, tree);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    redraw(tree, true);
    expect(panel(tree)).toMatchObject({ height: 'auto', opacity: 1 });
    act(() => tree.unmount());
  });

  it('is ready before the tap when a finger is down: entries in the tree, measured, and the tap only has to glide', () => {
    const tree = show(false, undefined, true);
    expect(tree.root.findAllByType(Text)).toHaveLength(1);
    expect(panel(tree)).toMatchObject({ height: 0, opacity: 0 });
    expect(outerPanel(tree).props.pointerEvents).toBe('none');
    measure(tree, 96);
    // The tap: nothing to wait for, the glide starts in the same moment.
    show(true, tree, true);
    redraw(tree, true, true);
    expect(panel(tree)).toMatchObject({ height: 96, opacity: 1 });
    act(() => tree.unmount());
  });

  it('opens at once the second time: the height from the first opening is remembered', () => {
    const tree = show(true);
    measure(tree, 96);
    show(false, tree);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(outerPanel(tree)).toBeUndefined();
    show(true, tree);
    redraw(tree, true);
    expect(panel(tree)).toMatchObject({ height: 96, opacity: 1 });
    act(() => tree.unmount());
  });
});
