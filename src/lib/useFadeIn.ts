import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { DURATIONS } from './motionTimings';

/**
 * A short fade + slight rise-in for a screen's content, played once when the
 * screen appears — the one shared animation primitive for this, instead of
 * each screen hand-rolling its own Animated.Value plumbing.
 *
 * Once only, on purpose: it used to replay from invisible whenever the list
 * it watched reloaded (every return to the screen, every added row), which
 * read as the content blinking.
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
