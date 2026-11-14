import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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

/** How long an opening panel waits to be measured before it opens as tall as its entries. */
const MEASURE_WAIT = 150;

/**
 * A panel that opens and closes by animating its own height, so whatever sits below it moves with it, frame by
 * frame: in a list the cell then grows and shrinks smoothly. (An entering or exiting animation on the children
 * leaves the cell's own height to change at once: the rows below jump, and a gap opens and fills, or the rows
 * overlap the fading panel.) The height is a shared value on the UI thread (`useAnimatedStyle`, the path the progress
 * bars use), not a CSS transition: that was tried and did not work on a phone. Open when first shown it is simply
 * open; once closed it is taken out of the tree. Reduce motion: it jumps.
 *
 * It opens without a hitch because nothing is left to do when the tap lands: `warm` (set when a finger touches down)
 * puts the entries in the tree, hidden, and measures them, so the glide starts at once on the UI thread. A tap that
 * arrives unprepared mounts and measures first and starts the glide when the height is known, not before: the glide
 * is front-loaded (ease-out), and starting it blind would spend most of it unseen.
 */
export function Collapsible({
  open,
  warm = false,
  children,
}: {
  open: boolean;
  /** The entries are about to be wanted (a finger is down): have them in the tree and measured. */
  warm?: boolean;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const [mounted, setMounted] = useState(open);
  const natural = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);
  const style = useAnimatedStyle(() => panelStyle(natural.value, progress.value));
  // The height the panel last laid out at, and whether it ever failed to reach the content's: then it stops animating.
  const laidOut = useRef<number | null>(null);
  const [stuck, setStuck] = useState(false);
  // What the panel is heading for, and whether the glide towards it has started.
  const heading = useRef(open);
  const started = useRef(true);
  const glide = useCallback(() => {
    started.current = true;
    const to = heading.current ? 1 : 0;
    progress.set(reduce ? to : withTiming(to, timing(DURATIONS.standard)));
  }, [progress, reduce]);

  useEffect(() => {
    heading.current = open;
    if (open) setMounted(true);
    started.current = false;
    // Closing, or opening with the height known, glides at once. Opening without it waits for the measure.
    if (!open || reduce || natural.get() > 0) {
      glide();
      return;
    }
    const timer = setTimeout(() => {
      if (!started.current) glide();
    }, MEASURE_WAIT);
    return () => clearTimeout(timer);
  }, [open, reduce, natural, glide]);
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
      reduce ? 300 : MEASURE_WAIT + DURATIONS.standard + 250
    );
    return () => clearTimeout(timer);
  }, [open, stuck, reduce, natural]);

  // In the tree as soon as it is asked to open (the same render), while it closes, and from a finger touching down.
  if (!(open || mounted || warm)) return null;
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
          if (heading.current && !started.current) glide();
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
