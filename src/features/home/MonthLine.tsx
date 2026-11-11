import { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { timing } from '@/lib/animation';
import { useDrawnValue } from '@/lib/useDrawnValue';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { DURATIONS } from '@/lib/motionTimings';
import { heroPct, type HeroSlices } from './heroSlices';
import { styles } from './hero.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The four slices of the month, in the order the line draws them. */
export type SliceKey = 'spent' | 'saved' | 'due' | 'free';
const NAMES: Record<SliceKey, string> = { spent: 'Spent', saved: 'Saved', due: 'Bills left', free: 'Free' };

/** The line's resting thickness, and what a picked slice grows to. */
const LINE_H = 12;
const FOCUS_H = 18;
/** The slices that were not picked step back. */
const DIM = 0.35;

/** One slice: it grows when picked and its neighbours step back; both glide on the UI thread. */
function Segment({
  color,
  share,
  label,
  focused,
  dimmed,
  onPick,
}: {
  color: string;
  share: number;
  label: string;
  focused: boolean;
  dimmed: boolean;
  onPick: () => void;
}) {
  const reduce = useReduceMotion();
  const height = useSharedValue(focused ? FOCUS_H : LINE_H);
  const opacity = useSharedValue(dimmed ? DIM : 1);
  const targetH = focused ? FOCUS_H : LINE_H;
  const targetO = dimmed ? DIM : 1;
  useEffect(() => {
    height.value = reduce ? targetH : withTiming(targetH, timing(DURATIONS.standard));
    opacity.value = reduce ? targetO : withTiming(targetO, timing(DURATIONS.standard));
    return () => {
      cancelAnimation(height);
      cancelAnimation(opacity);
    };
  }, [targetH, targetO, reduce, height, opacity]);
  const animated = useAnimatedStyle(() => ({ height: height.value, opacity: opacity.value }));
  return (
    <AnimatedPressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      // The line is thin, so the touch area reaches above and below it.
      hitSlop={{ top: 14, bottom: 14 }}
      style={[styles.lineSegment, { flexGrow: share, flexBasis: 0, backgroundColor: color }, animated]}
    />
  );
}

/**
 * The month as one rounded line: spent, saved, bills still to pay and free, in the colours of the legend below
 * it. It always fills the width, so with savings hidden the free share is shown against what is left rather
 * than leaving a gap the size of the savings. It draws in from the left once per period. Given `onPick`, each
 * slice is a button: the picked one grows and the rest step back.
 */
export function MonthLine({
  slices,
  hideSavings,
  periodKey,
  dayShare = null,
  focus = null,
  onPick,
}: {
  slices: HeroSlices;
  hideSavings: boolean;
  periodKey: string;
  /** How far through the month today is (0–1): a tick on the line, so spending reads against time. */
  dayShare?: number | null;
  /** The slice picked, if any. */
  focus?: SliceKey | null;
  /** Makes each slice a button that picks it (picking the picked one clears it). */
  onPick?: (key: SliceKey) => void;
}) {
  const draw = useDrawnValue(`month-line:${periodKey}`, 1, DURATIONS.standard);
  const drawStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: draw.value }] }));
  const parts: { key: SliceKey; share: number; color: string }[] = [
    { key: 'spent' as const, share: slices.spent, color: theme.colors.slice.spent },
    { key: 'saved' as const, share: hideSavings ? 0 : slices.saved, color: theme.colors.slice.saved },
    { key: 'due' as const, share: slices.due ?? 0, color: theme.colors.slice.due },
    { key: 'free' as const, share: slices.free, color: theme.colors.slice.free },
  ].filter((part) => part.share > 0);
  const label = `Where the month went: spent ${heroPct(slices.spent)}${
    hideSavings ? '' : `, saved ${heroPct(slices.saved)}`
  }${slices.due ? `, bills ${heroPct(slices.due)}` : ''}, free ${heroPct(slices.free)}`;
  const line = (
    <Animated.View
      // Static: one picture with a sentence. Interactive: each slice speaks for itself.
      {...(onPick
        ? {}
        : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label })}
      style={[styles.line, styles.lineOrigin, drawStyle]}
    >
      {parts.map((part) =>
        onPick ? (
          <Segment
            key={part.key}
            color={part.color}
            share={part.share}
            label={`${NAMES[part.key]}, ${heroPct(part.share)} of the month. ${focus === part.key ? 'Show free again' : 'Show this'}`}
            focused={focus === part.key}
            dimmed={focus != null && focus !== part.key}
            onPick={() => onPick(part.key)}
          />
        ) : (
          <View
            key={part.key}
            style={[styles.lineSegment, { flexGrow: part.share, flexBasis: 0, backgroundColor: part.color }]}
          />
        )
      )}
    </Animated.View>
  );
  return (
    <View style={styles.lineWrap}>
      {line}
      {dayShare != null && (
        <View
          pointerEvents="none"
          style={[styles.dayTick, { left: `${Math.min(100, Math.max(0, dayShare * 100))}%` }]}
        />
      )}
    </View>
  );
}
