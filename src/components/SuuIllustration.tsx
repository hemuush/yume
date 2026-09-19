import { useEffect } from 'react';
import { Image, Text, StyleSheet } from 'react-native';
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

// Suu — Yume's mascot, redrawn after the ring-mark rebrand. Earlier attempts
// tried to give Suu its own crescent shape, and later to put a face on the
// app icon's exact silhouette — both read as a mismatch with the icon, or
// as a face awkwardly stuck onto a shape that was never built to hold one.
// This is a different idea, signed off in session: Suu isn't a character
// wearing the logo, Suu *is* the logo — the same ring asset the app icon
// uses, with no face at all. Personality comes entirely from the one dot:
// centered and full-size at rest, shrunk/dimmed/drifted down for 'sleepy'.
// 'peek' renders like 'default', matching every earlier version of this
// component. The dot's colour comes from the active theme pack (coral by
// default, unchanged from before packs existed) — see `AccentContext`.
export function SuuIllustration({ size = 90, pose = 'default' }: Props) {
  const { dot } = useAccent();
  const sleepy = pose === 'sleepy';
  const dotSize = size * (sleepy ? 0.24 : 0.33);
  const dotRestOpacity = sleepy ? 0.55 : 1;

  // Idle breathing — the one character in the app, given the same "ambient
  // life" treatment the Home header's own Spark already has (see that
  // component's comment): a slow, small scale loop on the whole ring, plus a
  // softer opacity pulse on the dot alone, so Suu doesn't read as a static
  // sticker next to an animated background. Same withRepeat/cancelAnimation/
  // useReduceMotion pattern as Spark, deliberately — not mixed with core
  // React Native's `Animated`, which is exactly the import mismatch that
  // crashed BudgetRow/GoalCard/GoalChip in an earlier session.
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(dotRestOpacity);

  useEffect(() => {
    if (reduce) {
      scale.value = 1;
      dotOpacity.value = dotRestOpacity;
      return;
    }
    scale.value = withRepeat(withTiming(1.035, { duration: 1600 }), -1, true);
    dotOpacity.value = withRepeat(withTiming(dotRestOpacity * 0.78, { duration: 1600 }), -1, true);
    return () => {
      cancelAnimation(scale);
      cancelAnimation(dotOpacity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, dotRestOpacity]);

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
