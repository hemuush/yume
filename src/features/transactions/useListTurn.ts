import { useEffect, useRef } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { timing } from '@/lib/animation';
import { DURATIONS } from '@/lib/motionTimings';

/** How far the days start off to the side when the period steps. */
const TURN_DISTANCE = 36;

/**
 * The days turning the page with the period: when a new period's entries land they glide in from the side the step
 * came from (`direction` +1 forward, -1 back) while a sheet in the page colour clears off them; a Week/Month switch or a
 * picked month (direction 0) only clears. The list itself never goes translucent, so Android draws no card's shadow
 * through it. Nothing moves on first show or under reduce-motion.
 */
export function useListTurn(periodKey: string, direction: -1 | 0 | 1) {
  const reduce = useReduceMotion();
  const previous = useRef(periodKey);
  const x = useSharedValue(0);
  const cover = useSharedValue(0);
  const directionRef = useRef(direction);
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    // The first load ('' before it) is the screen arriving, not a page turn.
    const turned = previous.current !== '' && previous.current !== periodKey;
    previous.current = periodKey;
    if (!turned || reduce) return;
    cancelAnimation(x);
    cancelAnimation(cover);
    x.set(directionRef.current * TURN_DISTANCE);
    cover.set(1);
    x.set(withSpring(0, { damping: 18, stiffness: 190, mass: 0.8 }));
    cover.set(withTiming(0, timing(DURATIONS.slideIn)));
  }, [periodKey, reduce, x, cover]);

  const listStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
  return { listStyle, coverStyle };
}
