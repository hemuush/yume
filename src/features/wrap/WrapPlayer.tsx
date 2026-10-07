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
import Svg, { Path, Rect, Circle } from 'react-native-svg';
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
import { styles, wrapSky, WRAP_HILLS } from './wrap.styles';

/** Holding a finger down this long pauses instead of stepping. */
export const HOLD_MS = 220;

/** Where the sparks sit in the sky, as fractions of the screen, with their size and how bright they get. */
const SPARKS = [
  { x: 0.77, y: 0.16, size: 6, peak: 0.95, delay: 0 },
  { x: 0.16, y: 0.22, size: 4, peak: 0.8, delay: 900 },
  { x: 0.6, y: 0.3, size: 3, peak: 0.7, delay: 1700 },
  { x: 0.38, y: 0.11, size: 3, peak: 0.6, delay: 600 },
];

/** One white spark that slowly brightens and dims. Steady with reduce motion. */
function Spark({
  spark,
  w,
  h,
  still,
}: {
  spark: (typeof SPARKS)[number];
  w: number;
  h: number;
  still: boolean;
}) {
  const [t] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (still) {
      t.setValue(1);
      return;
    }
    const a = Animated.loop(
      Animated.sequence([
        Animated.delay(spark.delay),
        Animated.timing(t, {
          toValue: 0.35,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [t, still, spark.delay]);
  return (
    <Animated.View
      style={[
        styles.spark,
        {
          left: spark.x * w,
          top: spark.y * h,
          width: spark.size,
          height: spark.size,
          opacity: Animated.multiply(t, spark.peak),
        },
      ]}
    />
  );
}

/** Home's hills along the bottom of the story, with one small tree, rolling into the page cream. */
function Hills({ primary, secondary }: { primary: string; secondary: string }) {
  const h = WRAP_HILLS;
  return (
    <View style={[styles.hills, { height: h }]} pointerEvents="none">
      <Svg width="100%" height={h} viewBox={`0 0 360 ${h}`} preserveAspectRatio="none">
        <Path d="M0 18 C60 0 120 8 180 20 C240 32 300 6 360 16 V56 H0Z" fill={shade(secondary, 86, -8)} />
        <Path d="M0 30 C70 18 140 26 210 34 C270 40 320 26 360 29 V56 H0Z" fill={shade(primary, 84, -6)} />
        <Rect x={288} y={12} width={3} height={11} rx={1.5} fill="#B99A7A" />
        <Circle cx={289.5} cy={10} r={8} fill={shade(secondary, 72, -6)} />
        <Path d="M0 42 C90 36 180 40 260 44 C310 46 340 42 360 42 V56 H0Z" fill={theme.colors.background} />
      </Svg>
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

  const { accent, secondary } = useAccent();

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
      <LinearGradient colors={wrapSky(accent)} locations={[0, 0.46, 1]} style={styles.fill} />
      <View style={styles.fill} pointerEvents="none">
        {size.w > 0 &&
          SPARKS.map((sp, k) => <Spark key={k} spark={sp} w={size.w} h={size.h} still={still} />)}
      </View>
      <Hills primary={accent} secondary={secondary} />

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
