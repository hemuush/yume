import { useEffect, useRef, useState } from 'react';
import { PanResponder, PanResponderInstance } from 'react-native';

/**
 * A horizontal drag on a nav row steps to the previous/next period, like the chevrons without a 36px target.
 * Core `PanResponder` (no gesture-handler dep); `onPrev`/`onNext` go via refs so fresh closures aren't stale.
 */
export function useSwipeStep(onPrev: () => void, onNext: () => void, threshold = 40): PanResponderInstance {
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onPrevRef.current = onPrev;
    onNextRef.current = onNext;
  });

  // The refs are only read inside `onPanResponderRelease` (later, on release): the safe "latest ref" pattern.
  // eslint-disable-next-line react-hooks/refs
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
