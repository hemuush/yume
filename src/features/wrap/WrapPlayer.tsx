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
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { Wrap, BEAT_MS } from './wrapData';
import { Beat } from './WrapBeats';
import { styles, beatGradient } from './wrap.styles';

/** Holding a finger down this long pauses instead of stepping. */
export const HOLD_MS = 220;
/** How long one beat's colours take to fade into the next's. */
const FADE_MS = 450;

/**
 * Two soft shapes drifting behind a beat in deeper shades of its colours: the "colour stories" motion that
 * keeps beats alive without competing. Still with reduce motion.
 */
function Blobs({ colors, still }: { colors: [string, string]; still: boolean }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [t, still]);
  const up = t.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const down = t.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View
        style={[
          styles.blob,
          {
            width: 260,
            height: 260,
            right: -90,
            top: 110,
            backgroundColor: shade(colors[0], 80),
            opacity: 0.55,
          },
          { transform: [{ translateY: up }] },
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          {
            width: 190,
            height: 190,
            left: -70,
            bottom: 90,
            backgroundColor: shade(colors[1], 80),
            opacity: 0.5,
          },
          { transform: [{ translateY: down }] },
        ]}
      />
    </View>
  );
}

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
 * Plays a Wrap one beat at a time with a segment bar on top: tap the right two thirds to skip, the left third
 * to go back, hold to pause. The last beat stays up with its buttons. With reduce motion nothing auto-advances.
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

  // Each beat's colours fade in over the last one's (Direction A: colour stories).
  const { accent, secondary } = useAccent();
  const shownColors = useRef(beatGradient(wrap.beats[0].kind, accent, secondary));
  const [layers, setLayers] = useState(() => {
    const first = beatGradient(wrap.beats[0].kind, accent, secondary);
    return { under: first, over: first };
  });
  const [fade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const next = beatGradient(wrap.beats[index].kind, accent, secondary);
    setLayers({ under: shownColors.current, over: next });
    shownColors.current = next;
    if (still) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    const a = Animated.timing(fade, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [index, wrap.beats, accent, secondary, still, fade]);

  const [size, setSize] = useState({ w: 0, h: 0 });

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
  const beat = wrap.beats[index];

  return (
    <View style={styles.root} onLayout={onLayout}>
      <LinearGradient colors={layers.under} style={styles.fill} />
      <Animated.View style={[styles.fill, { opacity: fade }]} pointerEvents="none">
        <LinearGradient colors={layers.over} style={styles.fill} />
      </Animated.View>
      <Blobs colors={layers.over} still={still} />

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
        <Beat key={`${index}:${replay}`} wrap={wrap} beat={beat} still={still} onOpenReport={onOpenReport} />
      </Pressable>

      {paused && (
        <View style={styles.paused} pointerEvents="none">
          <Text style={styles.pausedText}>Paused</Text>
        </View>
      )}
    </View>
  );
}
