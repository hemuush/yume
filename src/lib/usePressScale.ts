import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * A quiet press-down for tappable things: they ease in a touch and dim slightly, then settle back with no
 * bounce. One shared Animated.Value drives the scale and the dim, so they always move together.
 */
export function usePressScale(pressedScale = 0.97) {
  // Lazy state init (not useRef.current) so the Animated.Value is created once
  // and read as a plain value in render — the shape the hooks lint rules want.
  const [scale] = useState(() => new Animated.Value(1));

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: pressedScale,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
  };

  // Derived from the same driver, not Pressable's `pressed` render-prop, which doesn't compose with
  // Animated.createAnimatedComponent (Animated needs a plain style object/array to find animated nodes).
  const opacity = scale.interpolate({ inputRange: [pressedScale, 1], outputRange: [0.85, 1] });

  return {
    animatedStyle: { transform: [{ scale }], opacity },
    onPressIn,
    onPressOut,
  };
}
