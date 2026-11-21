import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), warn: jest.fn() } }));

import { SwipeToDelete, claimsSwipe, swipeOffset } from './SwipeToDelete';

describe('swipeOffset', () => {
  it('follows the finger left up to the trigger, and not at all to the right', () => {
    expect(swipeOffset(-40)).toBe(-40);
    expect(swipeOffset(-88)).toBe(-88);
    expect(swipeOffset(30)).toBe(0);
  });
  it('holds the row back past the trigger', () => {
    expect(swipeOffset(-188)).toBeCloseTo(-88 - 100 * 0.35);
  });
});

describe('claimsSwipe', () => {
  it('takes a clear leftward drag', () => expect(claimsSwipe(-30, 4)).toBe(true));
  it('leaves a vertical drag to the list, and a rightward one to nobody', () => {
    expect(claimsSwipe(-30, 40)).toBe(false);
    expect(claimsSwipe(-30, 20)).toBe(false);
    expect(claimsSwipe(30, 2)).toBe(false);
    expect(claimsSwipe(-5, 0)).toBe(false);
  });
});

it('is just its row at rest: no red Delete, no extra layer behind it', () => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <SwipeToDelete onDelete={async () => true}>
        <Text>Phone cover</Text>
      </SwipeToDelete>
    );
  });
  const texts = tree.root.findAllByType(Text).map((n) => n.props.children);
  expect(texts).toEqual(['Phone cover']);
  act(() => tree.unmount());
});

/**
 * Drives the row's real PanResponder with touch events whose timestamps only ever go up (the responder ignores a move
 * that is not newer than the last one it has counted).
 */
describe('dragging the row', () => {
  let clock = 0;
  const touch = (x: number) => {
    clock += 10;
    return {
      touchHistory: {
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: clock,
        numberActiveTouches: 1,
        touchBank: [
          {
            touchActive: true,
            startPageX: 0,
            startPageY: 0,
            startTimeStamp: clock,
            currentPageX: x,
            currentPageY: 0,
            currentTimeStamp: clock,
            previousPageX: 0,
            previousPageY: 0,
            previousTimeStamp: clock - 5,
          },
        ],
      },
      nativeEvent: { touches: [{ pageX: x, pageY: 0 }], timestamp: clock },
    };
  };
  /** Presses down, drags left by `dx` and lets go. */
  function drag(tree: ReturnType<typeof create>, dx: number) {
    const row = tree.root.findAll((n) => typeof n.props.onResponderRelease === 'function')[0].props;
    act(() => {
      row.onStartShouldSetResponderCapture(touch(0));
      // The touch system works out how far the finger has moved in the capture step, then asks the row whether it
      // wants the gesture; only if it does is the row handed it.
      const first = touch(dx);
      row.onMoveShouldSetResponderCapture(first);
      if (!row.onMoveShouldSetResponder(first)) return;
      row.onResponderGrant(first);
      row.onResponderMove(touch(dx));
      row.onResponderRelease(touch(dx));
    });
  }
  const mount = (onDelete: () => Promise<boolean>, enabled = true) => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <SwipeToDelete onDelete={onDelete} enabled={enabled}>
          <Text>Phone cover</Text>
        </SwipeToDelete>
      );
    });
    return tree;
  };

  it('deletes once when let go past the trigger', async () => {
    const onDelete = jest.fn(async () => true);
    const tree = mount(onDelete);
    drag(tree, -120);
    await act(async () => {});
    expect(onDelete).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('springs back and deletes nothing when let go short of the trigger', async () => {
    const onDelete = jest.fn(async () => true);
    const tree = mount(onDelete);
    drag(tree, -40);
    await act(async () => {});
    expect(onDelete).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('shows the row again, and deletes nothing more, when the delete is refused', async () => {
    const onDelete = jest.fn(async () => false);
    const tree = mount(onDelete);
    drag(tree, -150);
    await act(async () => {});
    expect(onDelete).toHaveBeenCalledTimes(1);
    // Free to be swiped again once it is back.
    drag(tree, -150);
    await act(async () => {});
    expect(onDelete).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });

  it('does not ask twice while the first delete is still being made', async () => {
    let finish!: (deleted: boolean) => void;
    const onDelete = jest.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    const tree = mount(onDelete);
    drag(tree, -150);
    drag(tree, -150);
    expect(onDelete).toHaveBeenCalledTimes(1);
    await act(async () => finish(true));
    act(() => tree.unmount());
  });

  it('does not take the touch at all when it is switched off', async () => {
    const onDelete = jest.fn(async () => true);
    const tree = mount(onDelete, false);
    drag(tree, -150);
    await act(async () => {});
    expect(onDelete).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
