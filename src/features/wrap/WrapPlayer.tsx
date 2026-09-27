import { useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Animated,
  Easing,
  AccessibilityInfo,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { Wrap, BEAT_MS } from './wrapData';
import { Beat } from './WrapBeats';
import { styles, BEAT_BG } from './wrap.styles';

/** Holding a finger down this long pauses instead of stepping. */
export const HOLD_MS = 220;
/** The colour wipe between beats. */
const WIPE_MS = 420;

/** Whether a screen reader is running: a timer moving the story on would pull the page out from under it. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (alive) setOn(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

/**
 * Plays a Wrap: one beat at a time, each for its own length, with a segment
 * bar across the top like a set of stories. Tap the right two thirds to
 * skip ahead, the left third to go back, hold anywhere to pause. The last
 * beat stays up with its two buttons. With reduce motion (or a screen
 * reader) nothing moves on by itself: every beat shows its finished state
 * and a tap moves on.
 */
export function WrapPlayer({
  wrap,
  onClose,
  onOpenReport,
}: {
  wrap: Wrap;
  onClose: () => void;
  onOpenReport: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const screenReader = useScreenReader();
  const still = reduce || screenReader;
  const last = wrap.beats.length - 1;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped to replay the current beat from its start (tapping back on the first one).
  const [replay, setReplay] = useState(0);
  const [progress] = useState(() => wrap.beats.map(() => new Animated.Value(0)));
  // Where the current beat's bar had got to when it was paused.
  const from = useRef(0);
  const shown = useRef<string>('');

  useEffect(() => {
    const key = `${index}:${replay}`;
    if (shown.current !== key) {
      shown.current = key;
      from.current = 0;
    }
    progress.forEach((p, k) => {
      if (k < index) p.setValue(1);
      else if (k > index) p.setValue(0);
    });
    const bar = progress[index];
    if (still) {
      bar.setValue(1);
      return;
    }
    bar.setValue(from.current);
    if (paused) return;
    const a = Animated.timing(bar, {
      toValue: 1,
      duration: BEAT_MS[wrap.beats[index].kind] * (1 - from.current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    a.start(({ finished }) => {
      if (finished && index < last) setIndex(index + 1);
    });
    return () => bar.stopAnimation((v) => (from.current = v));
  }, [index, replay, paused, still, progress, wrap.beats, last]);

  // The ground colour, and the wipe that brings the next beat's colour in.
  const [ground, setGround] = useState(BEAT_BG[wrap.beats[0].kind]);
  const [wipe, setWipe] = useState<{ color: string; key: number } | null>(null);
  const [wipeScale] = useState(() => new Animated.Value(0));
  const [size, setSize] = useState({ w: 0, h: 0 });
  const prevIndex = useRef(0);
  useEffect(() => {
    const color = BEAT_BG[wrap.beats[index].kind];
    const forward = index > prevIndex.current;
    prevIndex.current = index;
    if (!forward || still || size.w === 0 || color === ground) {
      setWipe(null);
      setGround(color);
      return;
    }
    setWipe({ color, key: index });
    wipeScale.setValue(0);
    const a = Animated.timing(wipeScale, {
      toValue: 1,
      duration: WIPE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start(({ finished }) => {
      if (!finished) return;
      setGround(color);
      setWipe(null);
    });
    return () => a.stop();
    // `ground` is read as it was when this beat began; re-running on it would restart the wipe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const step = (dir: -1 | 1) => {
    setPaused(false);
    if (dir > 0) {
      if (index < last) {
        haptics.tap();
        setIndex(index + 1);
      }
      return;
    }
    if (index > 0) setIndex(index - 1);
    else setReplay((n) => n + 1);
  };

  // Tap to step, hold to pause: decided when the finger lifts.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    []
  );
  const onPressIn = () => {
    held.current = false;
    if (still) return;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setPaused(true);
    }, HOLD_MS);
  };
  const onPressOut = (e: GestureResponderEvent) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (held.current) {
      held.current = false;
      setPaused(false);
      return;
    }
    step(e.nativeEvent.pageX < size.w / 3 ? -1 : 1);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };
  // The wipe is a circle that grows from just below the middle until it covers the screen.
  const diameter = 2 * Math.hypot(size.w, size.h);
  const beat = wrap.beats[index];

  return (
    <View style={[styles.root, { backgroundColor: ground }]} onLayout={onLayout}>
      {wipe && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wipe,
            {
              width: diameter,
              height: diameter,
              borderRadius: diameter / 2,
              left: size.w / 2 - diameter / 2,
              top: size.h * 0.6 - diameter / 2,
              backgroundColor: wipe.color,
              transform: [{ scale: wipeScale }],
            },
          ]}
        />
      )}

      <View style={{ paddingTop: insets.top + 10 }}>
        <View style={styles.segs} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {progress.map((p, k) => (
            <View key={k} style={styles.seg}>
              <Animated.View
                style={[
                  styles.segFill,
                  { width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.topBar}>
          <Text style={styles.topLabel}>{wrap.label}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={withPressed(styles.close)}
          >
            <Feather name="x" size={16} color={theme.colors.ink} />
          </Pressable>
        </View>
      </View>

      <Pressable
        style={[styles.tapArea, { paddingBottom: insets.bottom }]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={index < last ? `Part ${index + 1} of ${last + 1}. Next part` : undefined}
        accessibilityHint={index < last ? 'Tap the left side to go back.' : undefined}
        accessible={index < last}
      >
        <Beat
          key={`${index}:${replay}`}
          beat={beat}
          still={still}
          onOpenReport={onOpenReport}
          onDone={onClose}
        />
      </Pressable>

      {paused && (
        <View style={styles.paused} pointerEvents="none">
          <Text style={styles.pausedText}>Paused</Text>
        </View>
      )}
    </View>
  );
}
