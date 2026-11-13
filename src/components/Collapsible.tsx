import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { timing } from '@/lib/animation';
import { DURATIONS } from '@/lib/motionTimings';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * The panel's height and opacity for how open it is. `natural` is the content's own height (0 until it has been
 * measured), `progress` runs 0 (closed) to 1 (open). Unmeasured, it is hidden while it opens and simply as tall as its
 * content once open: if the measuring ever fails, the entries still show, they just do not glide.
 */
export function panelStyle(natural: number, progress: number) {
  'worklet';
  if (natural > 0) return { height: natural * progress, opacity: progress };
  return progress >= 1 ? { height: 'auto' as const, opacity: 1 } : { height: 0, opacity: 0 };
}

/**
 * A panel that opens and closes by animating its own height, so whatever sits below it moves with it, frame by
 * frame: in a list the cell then grows and shrinks smoothly. (An entering or exiting animation on the children
 * leaves the cell's own height to change at once: the rows below jump, and a gap opens and fills, or the rows
 * overlap the fading panel.) The height is a shared value on the UI thread (`useAnimatedStyle`, the path the progress
 * bars use), not a CSS transition: that was tried and did not work on a phone. Open when first shown it is simply
 * open; once closed it is taken out of the tree. Reduce motion: it jumps.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReduceMotion();
  const [mounted, setMounted] = useState(open);
  const natural = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);
  const style = useAnimatedStyle(() => panelStyle(natural.value, progress.value));
  // The height the panel last laid out at, and whether it ever failed to reach the content's: then it stops animating.
  const laidOut = useRef<number | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
    progress.set(reduce ? (open ? 1 : 0) : withTiming(open ? 1 : 0, timing(DURATIONS.standard)));
  }, [open, reduce, progress]);
  // Out of the tree once it has closed (a touch longer than the glide). A panel that never opened has nothing to
  // close: a timer there once landed after the next opening and removed it.
  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), reduce ? 0 : DURATIONS.standard + 50);
    return () => clearTimeout(timer);
  }, [open, mounted, reduce]);
  useEffect(() => () => cancelAnimation(progress), [progress]);
  // A safety net: if the animation does not take (the panel is still shorter than its entries well after it should
  // have opened), the entries are shown as plain rows from then on. A hidden panel is worse than one that does not glide.
  useEffect(() => {
    if (!open || stuck) return;
    const timer = setTimeout(
      () => {
        const height = laidOut.current;
        if (height != null && natural.get() > 0 && height < natural.get() - 2) setStuck(true);
      },
      reduce ? 300 : DURATIONS.standard + 250
    );
    return () => clearTimeout(timer);
  }, [open, stuck, reduce, natural]);

  if (!mounted) return null;
  if (stuck) return <View>{children}</View>;
  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[{ overflow: 'hidden' }, style]}
      onLayout={(event) => {
        laidOut.current = event.nativeEvent.layout.height;
      }}
    >
      <View
        onLayout={(event) => {
          natural.set(Math.round(event.nativeEvent.layout.height));
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
