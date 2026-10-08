import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import ReanimatedAnimated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { GrowRect, subscribeCardGrow } from '@/lib/cardGrow';
import { useReduceMotion } from '@/lib/useReduceMotion';

const GROW_MS = 240;
const SETTLE_MS = 140;
const FADE_MS = 180;

/**
 * Mounted once above the Stack. A card that opens a full page registers its rect (see `useCardGrow`); this
 * paints a page-coloured panel that grows from that rect to the whole screen while the new screen fades in
 * beneath, then fades away. Expo Router has no Android shared-element transition, so this stands in for one.
 * It never takes touches and does nothing with reduce motion on. Every value runs on the UI thread, so the
 * grow stays smooth while the new screen mounts on the JS thread.
 */
export function CardGrowHost() {
  const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [active, setActive] = useState(false);
  const grow = useSharedValue(0);
  const fade = useSharedValue(1);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromW = useSharedValue(0);
  const fromH = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    return subscribeCardGrow((next: GrowRect) => {
      fromX.set(next.x);
      fromY.set(next.y);
      fromW.set(next.width);
      fromH.set(next.height);
      grow.set(0);
      fade.set(1);
      setActive(true);
      grow.set(withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }));
      fade.set(
        withDelay(
          GROW_MS + SETTLE_MS,
          withTiming(0, { duration: FADE_MS }, (finished) => {
            if (finished) runOnJS(setActive)(false);
          })
        )
      );
    });
  }, [reduce, grow, fade, fromX, fromY, fromW, fromH]);

  const panelStyle = useAnimatedStyle(() => ({
    left: interpolate(grow.get(), [0, 1], [fromX.get(), 0]),
    top: interpolate(grow.get(), [0, 1], [fromY.get(), 0]),
    width: interpolate(grow.get(), [0, 1], [fromW.get(), width]),
    height: interpolate(grow.get(), [0, 1], [fromH.get(), height]),
    borderRadius: interpolate(grow.get(), [0, 1], [theme.radius.xl, 0]),
    backgroundColor: interpolateColor(grow.get(), [0, 1], [theme.colors.surface, theme.colors.background]),
    opacity: fade.get(),
  }));

  if (!active) return null;
  return (
    <ReanimatedAnimated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={[styles.panel, panelStyle]}
    />
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
});
