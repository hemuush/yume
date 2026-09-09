import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

/**
 * A short fade + slight rise-in for a screen's content on mount/focus —
 * the one shared animation primitive for this, instead of each screen
 * hand-rolling its own Animated.Value plumbing.
 */
export function useFadeIn(deps: readonly unknown[] = []) {
  // Lazy state init (not useRef.current) so it reads as a plain value in render.
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    value.setValue(0);
    Animated.timing(value, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
}
