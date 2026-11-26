import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * A lively press for tappable cards and buttons: they sink quickly under the finger and spring back with a small
 * overshoot when let go. Scale only, never a dim: Android fades a card child by child, so a dimmed card showed its
 * own shadow through it.
 */
export function usePressScale(pressedScale = 0.97) {
  // Nothing shrinks more than 5%, so a big card never looks like it collapses.
  const targetScale = Math.max(0.95, Math.min(0.995, pressedScale));
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
      duration: 90,
      easing: Easing.out(Easing.quad),
    }).start();
  };
  const onPressOut = () => {
    scale.stopAnimation();
    if (reduce) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 9 }).start();
  };

  return {
    animatedStyle: { transform: [{ scale }] },
    onPressIn,
    onPressOut,
  };
}
