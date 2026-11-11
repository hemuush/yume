import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * A quiet press-down for tappable things: they ease in a touch and dim slightly, then settle back with no
 * bounce. One shared Animated.Value drives the scale and the dim, so they always move together.
 */
export function usePressScale(pressedScale = 0.99) {
  // Keep older callers quiet too: no control shrinks more than 3%.
  const targetScale = Math.max(0.97, Math.min(0.995, pressedScale));
  // Lazy state init (not useRef.current) so the Animated.Value is created once
  // and read as a plain value in render — the shape the hooks lint rules want.
  const [scale] = useState(() => new Animated.Value(1));
  const reduce = useReduceMotion();
  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    return () => scale.stopAnimation();
  }, [reduce, scale]);

  const onPressIn = () => {
    scale.stopAnimation();
    if (reduce) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: targetScale,
      useNativeDriver: true,
      duration: 80,
      easing: Easing.out(Easing.quad),
    }).start();
  };
  const onPressOut = () => {
    scale.stopAnimation();
    if (reduce) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: 1,
      useNativeDriver: true,
      duration: 120,
      easing: Easing.out(Easing.quad),
    }).start();
  };

  // Derived from the same driver, not Pressable's `pressed` render-prop, which doesn't compose with
  // Animated.createAnimatedComponent (Animated needs a plain style object/array to find animated nodes).
  const opacity = scale.interpolate({
    inputRange: [targetScale, 1],
    outputRange: [0.92, 1],
    extrapolate: 'clamp',
  });

  return {
    animatedStyle: { transform: [{ scale }], opacity },
    onPressIn,
    onPressOut,
  };
}
