import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { MOTION } from '@/lib/animation';
import { useReduceMotion } from '@/hooks/useReduceMotion';

type Props = Omit<ComponentProps<typeof Animated.View>, 'children'> & {
  children?: ReactNode;
  /** Fade in when this view first appears; false shows it at once. */
  play?: boolean;
  /** The colour behind the content (the page by default; a card’s surface for rows inside a card). */
  coverColor?: string;
  duration?: number;
};

/**
 * Fades its content in without ever making it translucent: a sheet in the colour behind it lies on top and fades
 * away. Android fades a translucent view child by child, so a fading card showed its own shadow (and whatever was
 * behind it) through it as a grey frame; this has one flat layer to fade instead.
 */
export function SolidFade({ play = true, coverColor, duration = MOTION.quick, children, ...rest }: Props) {
  const reduce = useReduceMotion();
  const cover = useSharedValue(play && !reduce ? 1 : 0);
  useEffect(() => {
    if (cover.get() > 0) cover.set(withTiming(0, { duration, easing: MOTION.ease }));
  }, [cover, duration]);
  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
  return (
    <Animated.View {...rest}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: coverColor ?? theme.colors.background },
          coverStyle,
        ]}
      />
    </Animated.View>
  );
}
