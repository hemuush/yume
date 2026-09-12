import { useEffect, useRef, useState } from 'react';
import { PanResponder, PanResponderInstance } from 'react-native';

/**
 * A horizontal drag on a nav row steps to the previous/next period — the
 * same thing tapping the row's own chevron buttons already does, just
 * without needing to hit a small 36px target. Built on React Native's core
 * `PanResponder` rather than `react-native-gesture-handler` (not a
 * dependency anywhere else in the app yet, and this doesn't need anything
 * gesture-handler offers beyond a plain drag-and-release).
 *
 * `onPrev`/`onNext` are read through a ref rather than captured directly, so
 * a caller passing a fresh closure every render (the normal case — `() =>
 * onChange(stepPeriod(cursor, -1))`) never leaves the gesture handler stuck
 * on the render it was created on.
 */
export function useSwipeStep(onPrev: () => void, onNext: () => void, threshold = 40): PanResponderInstance {
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onPrevRef.current = onPrev;
    onNextRef.current = onNext;
  });

  const [responder] = useState(() =>
    PanResponder.create({
      // Mostly-horizontal drags only — a mostly-vertical one is a scroll
      // gesture on whatever's beneath this row and must pass through.
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      // Right = reveal the previous period, left = next — the same
      // direction convention iOS Calendar/Photos use.
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > threshold) onPrevRef.current();
        else if (gesture.dx < -threshold) onNextRef.current();
      },
    })
  );
  return responder;
}
