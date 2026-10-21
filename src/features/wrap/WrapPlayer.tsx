import { themeInk } from '@/theme/interactionColors';
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Animated,
  Easing,
  AccessibilityInfo,
  GestureResponderEvent,
  LayoutChangeEvent,
  ScrollView,
  AppState,
  ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { Wrap, BEAT_MS, CHAPTER_LABELS } from './wrapData';
import { Beat } from './WrapBeats';
import { styles } from './wrap.styles';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';

/** Holding a finger down this long pauses instead of stepping. */
export const HOLD_MS = 220;

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
  onOpenDay,
}: {
  wrap: Wrap;
  onClose: () => void;
  onOpenReport: () => void;
  onOpenDay?: (date: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const screenReader = useScreenReader();
  const still = reduce || screenReader;
  const last = wrap.beats.length - 1;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [active, setActive] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive'
  );
  const [headerHeight, setHeaderHeight] = useState(180);
  const chapterScroll = useRef<ScrollViewInstance>(null);
  const storyScroll = useRef<ScrollViewInstance>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const chapterPositions = useRef<number[]>([]);
  const stopped = paused || holding || !active;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (state !== 'active') {
        if (holdTimer.current) clearTimeout(holdTimer.current);
        held.current = false;
        setHolding(false);
      }
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    chapterScroll.current?.scrollTo({
      x: Math.max(0, (chapterPositions.current[index] ?? 0) - 24),
      animated: !still,
    });
  }, [index, still]);
  // Bumped to replay the current beat from its start (tapping back on the first one).
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    storyScroll.current?.scrollTo({ y: 0, animated: false });
  }, [index, replay]);
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
    if (still || index === last) {
      bar.setValue(1);
      return;
    }
    bar.setValue(from.current);
    if (stopped) return;
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
  }, [index, replay, stopped, still, progress, wrap.beats, last]);

  const { accent, secondary } = useAccent();

  const [size, setSize] = useState({ w: 0, h: 0 });

  const step = (dir: -1 | 1) => {
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

  // Navigate only on a completed press; a scroll cancel must never change the chapter.
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
      setHolding(true);
    }, HOLD_MS);
  };
  const onPressOut = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHolding(false);
  };
  const onPress = (e: GestureResponderEvent) => {
    if (held.current) return;
    step(e.nativeEvent.pageX < size.w / 3 ? -1 : 1);
  };
  const replayWrap = () => {
    setIndex(0);
    setReplay((value) => value + 1);
    setPaused(false);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };
  const beat = wrap.beats[index];

  return (
    <View style={styles.root} onLayout={onLayout}>
      <HomeWallpaper accent={accent} secondary={secondary} />

      <View
        style={{ paddingTop: insets.top + 10 }}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
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
          {/* One stop for a screen reader: swipe up or down to move between parts. */}
          <View
            style={{ flex: 1 }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Your ${wrap.period}, wrapped, ${wrap.label}`}
            accessibilityValue={{
              text: `Part ${index + 1} of ${wrap.beats.length}, ${CHAPTER_LABELS[beat.kind]}`,
            }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'increment') step(1);
              else if (event.nativeEvent.actionName === 'decrement') step(-1);
            }}
          >
            <Text style={styles.topEyebrow}>
              Your {wrap.period}, wrapped · {index + 1} / {wrap.beats.length}
            </Text>
            <Text style={styles.topLabel}>{wrap.label}</Text>
          </View>
          {!still && index < last && (
            <Pressable
              onPress={() => setPaused((value) => !value)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={paused || holding ? 'Resume wrap' : 'Pause wrap'}
              style={withPressed(styles.close)}
            >
              <Feather name={paused || holding ? 'play' : 'pause'} size={16} color={theme.colors.ink} />
            </Pressable>
          )}
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
        <ScrollView
          ref={chapterScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chapters}
        >
          {wrap.beats.map((part, chapterIndex) => (
            <Pressable
              key={`${part.kind}:${chapterIndex}`}
              onLayout={(event) => {
                chapterPositions.current[chapterIndex] = event.nativeEvent.layout.x;
              }}
              onPress={() => {
                haptics.tap();
                setIndex(chapterIndex);
                setReplay((value) => value + 1);
                setPaused(true);
              }}
              style={withPressed([
                styles.chapter,
                chapterIndex === index && [
                  styles.chapterSelected,
                  { backgroundColor: themeInk(accent), borderColor: themeInk(accent) },
                ],
              ])}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${CHAPTER_LABELS[part.kind]}`}
              accessibilityState={{ selected: chapterIndex === index }}
            >
              <Text style={[styles.chapterText, chapterIndex === index && styles.chapterTextSelected]}>
                {CHAPTER_LABELS[part.kind]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {still && (
          <View style={styles.controls}>
            <Pressable
              style={withPressed(styles.control)}
              onPress={() => step(-1)}
              accessibilityRole="button"
              accessibilityLabel="Previous part"
            >
              <Feather name="chevron-left" size={18} color={theme.colors.ink} />
              <Text style={styles.controlText}>Previous</Text>
            </Pressable>
            <Pressable
              style={withPressed(styles.control)}
              onPress={() => step(1)}
              disabled={index === last}
              accessibilityRole="button"
              accessibilityLabel="Next part"
              accessibilityState={{ disabled: index === last }}
            >
              <Text style={[styles.controlText, index === last && { opacity: 0.4 }]}>Next</Text>
              <Feather name="chevron-right" size={18} color={theme.colors.ink} />
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView
        ref={storyScroll}
        style={styles.tapArea}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setPaused(true)}
      >
        <Pressable
          style={{ flexGrow: 1, minHeight: Math.max(0, size.h - headerHeight), paddingBottom: insets.bottom }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onPress}
          accessible={false}
          testID="wrap-story-surface"
        >
          <Beat
            key={`${index}:${replay}`}
            wrap={wrap}
            beat={beat}
            still={still}
            onOpenReport={onOpenReport}
            onOpenDay={onOpenDay}
            onInteract={() => setPaused(true)}
            onReplay={replayWrap}
          />
        </Pressable>
      </ScrollView>
    </View>
  );
}
