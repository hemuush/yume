import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { glide } from '@/lib/animation';
import { DURATIONS } from '@/lib/motionTimings';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * A panel that opens and closes by animating its own height, so whatever sits below it moves with it, frame by
 * frame: in a list the cell then grows and shrinks smoothly. (An entering or exiting animation on the children
 * leaves the cell's own height to change at once: the rows below jump, and a gap opens and fills, or the rows
 * overlap the fading panel.) The content is measured, then the height and the opacity glide on the UI thread as CSS
 * transitions. Open when first shown it is simply open, and a panel that has been closed is taken out of the tree
 * once it has finished closing. Reduce motion: it jumps.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReduceMotion();
  // The content's own height, measured while it is mounted: where the open panel stops.
  const [natural, setNatural] = useState(0);
  const [mounted, setMounted] = useState(open);
  // Nothing glides until the first real open or close, so a panel that mounts open (scrolled back into view) is open.
  const [seen, setSeen] = useState(open);
  const [toggled, setToggled] = useState(false);
  if (seen !== open) {
    setSeen(open);
    setToggled(true);
    if (open) setMounted(true);
  }
  useEffect(() => {
    if (open || !mounted) return;
    // Out of the tree once it has closed, and forgetting the height so the next opening grows from nothing.
    const close = () => {
      setMounted(false);
      setNatural(0);
    };
    if (reduce) {
      close();
      return;
    }
    // A touch longer than the glide.
    const timer = setTimeout(close, DURATIONS.standard + 50);
    return () => clearTimeout(timer);
  }, [open, mounted, reduce]);
  if (!mounted) return null;
  const measured = natural > 0;
  // Opening for the first time it starts at 0 until measured; closed it goes to 0; at rest it is as tall as its content.
  const height = open ? (measured ? natural : toggled ? 0 : undefined) : 0;
  const visible = open && (measured || !toggled);
  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[
        { overflow: 'hidden', opacity: visible ? 1 : 0 },
        height !== undefined && { height },
        glide(['height', 'opacity'], reduce || !toggled),
      ]}
    >
      <View onLayout={(event) => setNatural(Math.round(event.nativeEvent.layout.height))}>{children}</View>
    </Animated.View>
  );
}
