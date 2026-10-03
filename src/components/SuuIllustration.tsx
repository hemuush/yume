import { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { useReduceMotion } from '@/lib/useReduceMotion';

interface Props {
  size?: number;
  pose?: 'default' | 'peek' | 'sleepy';
}

// Suu is the logo itself (the app icon's ring asset, no face); personality comes from the one dot, in the
// theme pack's colour (see `AccentContext`): centered at rest, shrunk/dimmed/drifted down for 'sleepy'.
const BREATH_REPEATS = 6;

export function SuuIllustration({ size = 90, pose = 'default' }: Props) {
  const { dot } = useAccent();
  const sleepy = pose === 'sleepy';
  const dotSize = size * (sleepy ? 0.24 : 0.33);
  const dotRestOpacity = sleepy ? 0.55 : 1;

  // Idle breathing: a slow scale loop on the ring and a softer opacity pulse on the dot, like Home header's
  // Spark. Reanimated only (withRepeat/cancelAnimation/useReduceMotion); never mix core RN `Animated`.
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(dotRestOpacity);

  useEffect(() => {
    if (reduce) {
      scale.value = 1;
      dotOpacity.value = dotRestOpacity;
      return;
    }
    // Three breaths when Suu comes on screen, then rest (the Quiet motion
    // sign-off): in and out counts as two repeats, so 6 ends at rest.
    scale.value = withRepeat(withTiming(1.035, { duration: 1600 }), BREATH_REPEATS, true);
    dotOpacity.value = withRepeat(
      withTiming(dotRestOpacity * 0.78, { duration: 1600 }),
      BREATH_REPEATS,
      true
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(dotOpacity);
    };
  }, [reduce, dotRestOpacity, scale, dotOpacity]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  return (
    <ReanimatedAnimated.View style={[{ width: size, height: size }, ringStyle]}>
      <Image
        source={require('../../assets/suu-ring.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      <ReanimatedAnimated.View
        style={[
          styles.dot,
          { backgroundColor: dot },
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            left: size * (sleepy ? 0.5 : 0.47) - dotSize / 2,
            top: size * (sleepy ? 0.34 : 0.24) - dotSize / 2,
          },
          dotStyle,
        ]}
      />
      {sleepy && (
        <>
          <Text style={[styles.z, { fontSize: size * 0.16, right: size * 0.14, top: size * 0.08 }]}>z</Text>
          <Text style={[styles.z, { fontSize: size * 0.11, right: size * 0.06, top: size * 0.01 }]}>z</Text>
        </>
      )}
    </ReanimatedAnimated.View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute' },
  z: { position: 'absolute', fontFamily: theme.font.roundedBold, color: theme.colors.ink },
});
