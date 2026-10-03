import { useEffect, useRef, useState } from 'react';
import { PanResponder, PanResponderInstance } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { haptics } from '@/lib/haptics';
import { MOTION, timing } from '@/lib/animation';
import { useReduceMotion } from '@/lib/useReduceMotion';

/** How far a horizontal drag must travel before letting go steps the period. */
const SWIPE_STEP_PX = 60;

/**
 * Home's month-card drag for any period block: the views carrying `panHandlers` and `dragStyle` follow the finger
 * (0.9, or 0.22 past the newest period), and letting go beyond 60px steps -1 (back) or +1 (forward).
 * The stepping itself is the caller's, so a swipe does exactly what the chevrons do.
 */
export function useSwipeDrag(onStep: (direction: -1 | 1) => void, canStepForward: boolean) {
  const dragX = useSharedValue(0);
  const reduce = useReduceMotion();
  const onStepRef = useRef(onStep);
  const canForwardRef = useRef(canStepForward);
  const reduceRef = useRef(reduce);
  useEffect(() => {
    onStepRef.current = onStep;
    canForwardRef.current = canStepForward;
    reduceRef.current = reduce;
  });

  // The refs are only read inside gesture callbacks (see useSwipeStep).
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState<PanResponderInstance>(() => {
    const settle = (ms: number) => {
      dragX.value = reduceRef.current ? 0 : withTiming(0, timing(ms));
    };
    return PanResponder.create({
      // Mostly-horizontal drags only: a vertical one is the list scrolling.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const pastNewest = g.dx < 0 && !canForwardRef.current;
        dragX.value = g.dx * (pastNewest ? 0.22 : 0.9);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_STEP_PX) {
          settle(MOTION.slideOut);
          onStepRef.current(-1);
        } else if (g.dx < -SWIPE_STEP_PX && canForwardRef.current) {
          settle(MOTION.slideOut);
          onStepRef.current(1);
        } else {
          if (g.dx < -SWIPE_STEP_PX) haptics.tap();
          settle(MOTION.standard);
        }
      },
      onPanResponderTerminate: () => settle(MOTION.standard),
    });
  });

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));
  return { panHandlers: pan.panHandlers, dragStyle };
}
