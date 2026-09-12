import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * A subtle press-down "squash" for primary actions — one shared
 * Animated.Value driver instead of every button hand-rolling its own press
 * feedback. Every call site (~30 across the app after the button-press
 * pass) gets this for free.
 *
 * Previously a uniform `scale`, shrinking evenly on both axes — this now
 * splits the same single driver into independent scaleX/scaleY
 * interpolations (wider and shorter on press, back to 1:1 on release) so it
 * reads as the button's own material actually giving way under a finger,
 * not just shrinking in place. The release spring's existing bounciness
 * (unchanged) is what supplies the "settle" — a small overshoot past 1:1
 * before it comes to rest — so this needed no new timing/easing, only a
 * different transform shape driven by the same value.
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
  // Squash amount is a fraction of the same shrink depth already in play —
  // a deeper press (a smaller pressedScale) squashes wider too, so the two
  // axes move together instead of one being tuned independently.
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
