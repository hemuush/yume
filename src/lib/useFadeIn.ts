import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { DURATIONS } from './motionTimings';
import { useReduceMotion } from './useReduceMotion';

/**
 * A short fade + slight rise-in for a screen's content, played once on appearing; the shared primitive.
 * Once only on purpose: replaying on every list reload made the content blink. Reduce motion: shown at once.
 */
export function useFadeIn() {
  // Lazy state init (not useRef.current) so it reads as a plain value in render.
  const [value] = useState(() => new Animated.Value(0));
  const reduce = useReduceMotion();

  useEffect(() => {
    // The setting can resolve after the fade began; stopping there and jumping to the end covers that too.
    if (reduce) {
      value.stopAnimation();
      value.setValue(1);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: DURATIONS.enter,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [value, reduce]);

  return {
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
}
