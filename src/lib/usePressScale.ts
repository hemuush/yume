import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * Subtle press-down "squash" for primary actions: one shared Animated.Value drives independent scaleX/scaleY
 * (wider and shorter on press, 1:1 on release); the release spring's bounciness supplies the small overshoot.
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

  // Derived from the same driver, not Pressable's `pressed` render-prop, which doesn't compose with
  // Animated.createAnimatedComponent (Animated needs a plain style object/array to find animated nodes).
  const opacity = scale.interpolate({ inputRange: [pressedScale, 1], outputRange: [0.8, 1] });
  // Squash is a fraction of the same shrink depth, so a deeper press (smaller pressedScale) squashes wider
  // too and the two axes move together rather than being tuned independently.
  const scaleX = scale.interpolate({
    inputRange: [pressedScale, 1],
    outputRange: [1 + (1 - pressedScale) * 0.5, 1],
  });

  return {
    animatedStyle: { transform: [{ scaleX }, { scaleY: scale }], opacity },
    onPressIn,
    onPressOut,
  };
}
