import { useEffect, useRef, useState } from 'react';
import { PanResponder, GestureResponderEvent } from 'react-native';
import { haptics } from '@/lib/haptics';

/**
 * Touch-and-drag over a row of `count` evenly spaced points (a chart, a calendar row): a tap picks the
 * point under the finger, a horizontal drag follows it, a vertical one is left to the page's scroll.
 * Each change of point ticks once. `width` is the surface's laid-out width; call `setWidth` from onLayout.
 */
export function useScrub({
  count,
  inset = 0,
  onPick,
}: {
  count: number;
  /** Space at each end before the first / after the last point. */
  inset?: number;
  onPick: (index: number) => void;
}) {
  const width = useRef(0);
  const last = useRef<number | null>(null);
  const startX = useRef(0);
  const latest = useRef({ count, inset, onPick });
  useEffect(() => {
    latest.current = { count, inset, onPick };
  });

  const pick = (x: number) => {
    const { count: n, inset: pad, onPick: cb } = latest.current;
    const span = width.current - 2 * pad;
    if (n < 1 || span <= 0) return;
    const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((x - pad) / span) * (n - 1))));
    if (i === last.current) return;
    last.current = i;
    haptics.tap();
    cb(i);
  };

  // The refs are only read in the handlers, later, on touch: the safe "latest ref" pattern.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e: GestureResponderEvent) => {
        startX.current = e.nativeEvent.locationX;
        last.current = null;
        pick(startX.current);
      },
      onPanResponderMove: (_e, g) => pick(startX.current + g.dx),
      onPanResponderRelease: () => {
        last.current = null;
      },
    })
  );

  return {
    panHandlers: responder.panHandlers,
    onLayout: (w: number) => {
      width.current = w;
    },
  };
}
