import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * A subtle press-down scale for primary actions — one shared Animated.Value
 * driver instead of every button hand-rolling its own press feedback.
 */
export function usePressScale(pressedScale = 0.96) {
  // Lazy state init (not useRef.current) so the Animated.Value is created once
  // and read as a plain value in render — the shape the hooks lint rules want.
  const [scale] = useState(() => new Animated.Value(1));

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: pressedScale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  // Derived from the same driver rather than Pressable's `pressed` render-prop,
  // since that render-prop form doesn't compose with Animated.createAnimatedComponent
  // (Animated needs a plain style object/array to find the animated nodes in).
  const opacity = scale.interpolate({ inputRange: [pressedScale, 1], outputRange: [0.8, 1] });

  return { animatedStyle: { transform: [{ scale }], opacity }, onPressIn, onPressOut };
}
