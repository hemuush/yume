import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
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
 * It never takes touches and does nothing with reduce motion on.
 */
export function CardGrowHost() {
  const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [rect, setRect] = useState<GrowRect | null>(null);
  const [grow] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const run = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (reduce) return;
    return subscribeCardGrow((next) => {
      run.current?.stop();
      grow.setValue(0);
      fade.setValue(1);
      setRect(next);
      run.current = Animated.sequence([
        Animated.timing(grow, {
          toValue: 1,
          duration: GROW_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.delay(SETTLE_MS),
        Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: false }),
      ]);
      run.current.start(({ finished }) => {
        if (finished) setRect(null);
      });
    });
  }, [reduce, grow, fade]);

  useEffect(() => () => run.current?.stop(), []);

  if (!rect) return null;
  const lerp = (from: number, to: number) =>
    grow.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.panel,
        {
          left: lerp(rect.x, 0),
          top: lerp(rect.y, 0),
          width: lerp(rect.width, width),
          height: lerp(rect.height, height),
          borderRadius: lerp(theme.radius.xl, 0),
          backgroundColor: grow.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.colors.surface, theme.colors.background],
          }),
          opacity: fade,
        },
      ]}
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
