import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, PanResponder } from 'react-native';

/** Dragged this far (dp) or flung this fast (dp/ms) downward, a sheet lets go. */
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 0.8;

/** Whether a move is a downward swipe the sheet should take: mostly vertical, and only while its content is at the top. */
export function claimsSwipe(enabled: boolean, scrollY: number, dx: number, dy: number): boolean {
  return enabled && scrollY <= 1 && dy > 8 && dy > Math.abs(dx) * 1.5;
}

export function shouldCloseOnRelease(dy: number, vy: number): boolean {
  return dy > CLOSE_DISTANCE || (dy > 20 && vy > CLOSE_VELOCITY);
}

/**
 * Swipe a bottom sheet down to close it from anywhere on it: put `panHandlers` on the whole sheet surface, add `drag` to
 * its translateY and call `onScroll` from any scroll view inside. A mostly-vertical downward drag is taken (before the
 * scroll view or a button can have it) only while that content is at its top, so scrolling a long sheet back up still
 * works and taps are left alone. The sheet follows the finger, and on release either slides out and closes or settles
 * back. `resetKey` puts the sheet back in place when it opens again.
 */
export function useSwipeToClose({
  enabled,
  onClose,
  resetKey,
}: {
  enabled: boolean;
  onClose: () => void;
  resetKey?: unknown;
}) {
  const [drag] = useState(() => new Animated.Value(0));
  const latest = useRef({ enabled, onClose });
  const scrollY = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    []
  );
  useEffect(() => {
    latest.current = { enabled, onClose };
  });

  useEffect(() => {
    drag.setValue(0);
  }, [drag, resetKey]);

  // The ref is only read in the handlers, later, on touch: the safe "latest ref" pattern.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      // Capture, so it wins over the scroll view and buttons inside; only when the content is at its top.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        claimsSwipe(latest.current.enabled, scrollY.current, g.dx, g.dy),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (shouldCloseOnRelease(g.dy, g.vy)) {
          Animated.timing(drag, {
            toValue: 700,
            duration: 180,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            latest.current.onClose();
            // A close that was refused (a save began mid-drag) leaves the sheet where it was thrown: bring it back.
            // A closed sheet is gone by then, and unmounting cancels this.
            settle.current = setTimeout(() => {
              Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
            }, 600);
          });
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    })
  );

  return {
    drag,
    panHandlers: responder.panHandlers,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
    },
  };
}
