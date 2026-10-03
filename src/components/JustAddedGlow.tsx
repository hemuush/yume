import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { JustAddedSurface, justAddedVersion, subscribeJustAdded, takeJustAdded } from '@/lib/justAdded';

/** How long the gold holds before it starts to fade. */
const HOLD_MS = 450;
const FADE_MS = 900;

/**
 * A soft gold wash behind a row just saved on Add, fading after a moment (lib/justAdded). Make it the row's
 * first child: it fills the row behind the content. Reduce motion: shows then goes, no fade.
 */
export function JustAddedGlow({ ids, surface }: { ids: string[]; surface: JustAddedSurface }) {
  const reduce = useReduceMotion();
  const version = useSyncExternalStore(subscribeJustAdded, justAddedVersion);
  const [glow] = useState(() => new Animated.Value(0));
  const [on, setOn] = useState(false);
  const idsKey = ids.join('|');
  // Held in a ref, not stopped by the effect's cleanup: a later mark (another
  // save) re-runs the effect, and stopping a glow mid-way would leave it stuck on.
  const running = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => () => running.current?.stop(), []);

  useEffect(() => {
    if (!takeJustAdded(ids, surface)) return;
    setOn(true);
    glow.setValue(1);
    const anim = Animated.sequence([
      Animated.delay(reduce ? HOLD_MS + FADE_MS : HOLD_MS),
      Animated.timing(glow, {
        toValue: 0,
        duration: reduce ? 0 : FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    running.current?.stop();
    running.current = anim;
    anim.start(({ finished }) => {
      if (finished) setOn(false);
    });
    // `ids` is compared through idsKey; `reduce` only picks the style of a glow already decided.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, surface, version]);

  if (!on) return null;
  return <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow }]} />;
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.idGold },
});
