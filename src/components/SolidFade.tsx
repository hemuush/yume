import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
  /** Also rise this many dp into place, on a soft spring (0 = fade only). */
  rise?: number;
  /** Wait this long (ms) first, to stagger several blocks. */
  delay?: number;
};

/**
 * Fades its content in without ever making it translucent: a sheet in the colour behind it lies on top and fades
 * away. Android fades a translucent view child by child, so a fading card showed its own shadow (and whatever was
 * behind it) through it as a grey frame; this has one flat layer to fade instead. Rising moves it, never fades it.
 */
export function SolidFade({
  play = true,
  coverColor,
  duration = MOTION.quick,
  rise = 0,
  delay = 0,
  children,
  ...rest
}: Props) {
  const reduce = useReduceMotion();
  const animate = play && !reduce;
  const cover = useSharedValue(animate ? 1 : 0);
  const lift = useSharedValue(animate ? rise : 0);
  useEffect(() => {
    if (cover.get() > 0) cover.set(withDelay(delay, withTiming(0, { duration, easing: MOTION.ease })));
    if (lift.get() !== 0)
      lift.set(withDelay(delay, withSpring(0, { damping: 16, stiffness: 180, mass: 0.8 })));
  }, [cover, lift, duration, delay]);
  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  const coverView = (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: coverColor ?? theme.colors.background },
        coverStyle,
      ]}
    />
  );
  // Only a rising block gets an inner layer to move, so a plain fade keeps its children laid out by its own style.
  if (rise === 0) {
    return (
      <Animated.View {...rest}>
        {children}
        {coverView}
      </Animated.View>
    );
  }
  return (
    <Animated.View {...rest}>
      <Animated.View style={[styles.grow, liftStyle]}>
        {children}
        {coverView}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ grow: { flexGrow: 1 } });
