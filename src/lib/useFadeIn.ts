import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { DURATIONS } from './motionTimings';

/**
 * A short fade + slight rise-in for a screen's content, played once on appearing; the shared primitive.
 * Once only on purpose: replaying on every list reload made the content blink.
 */
export function useFadeIn() {
  // Lazy state init (not useRef.current) so it reads as a plain value in render.
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: DURATIONS.enter,
      useNativeDriver: true,
    }).start();
  }, [value]);

  return {
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
}
