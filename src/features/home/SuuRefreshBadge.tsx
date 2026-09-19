import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { SuuIllustration } from '@/components/SuuIllustration';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * A small branded "welcome back" pop, played once right when a pull-to-
 * refresh finishes — not during the pull itself. `RefreshControl`'s own
 * native spinner and gesture physics are left completely alone here:
 * reliably hiding/replacing those across iOS and Android needs a full
 * custom gesture-driven control, a bigger change than this pass; this is
 * the lower-risk version of the same idea — Suu still shows up to mark the
 * moment, just after the native spinner's own animation, not instead of it.
 * Suu pops in with a small overshoot, gives two side wobbles (reading as
 * "checking in on things"), then settles back out.
 */
export function SuuRefreshBadge({ refreshing }: { refreshing: boolean }) {
  const reduce = useReduceMotion();
  const wasRefreshing = useRef(false);
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (wasRefreshing.current && !refreshing && !reduce) {
      setVisible(true);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }
    wasRefreshing.current = refreshing;
  }, [refreshing, reduce, progress]);

  if (!visible) return null;

  const scale = progress.interpolate({
    inputRange: [0, 0.18, 0.85, 1],
    outputRange: [0.4, 1.08, 1, 0.6],
  });
  const opacity = progress.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 1, 1, 0] });
  const rotate = progress.interpolate({
    inputRange: [0, 0.3, 0.42, 0.54, 0.66, 1],
    outputRange: ['0deg', '-10deg', '10deg', '-8deg', '0deg', '0deg'],
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.badge, { opacity, transform: [{ scale }, { rotate }] }]}>
      <SuuIllustration size={40} pose="peek" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: 4, alignSelf: 'center', zIndex: 20 },
});
