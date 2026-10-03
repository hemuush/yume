import { useEffect } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import ReanimatedAnimated, {
  SharedValue,
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { MOTION, timing } from '@/lib/animation';
import { withPressed } from '@/lib/pressed';
import type { HeroMode, HeroSlices } from './heroSlices';

const AnimatedCircle = ReanimatedAnimated.createAnimatedComponent(Circle);

/** Slice colours — the month card's tiles use the same ones; `due` (bills still to pay) has no tile. */
export const RING_COLORS = {
  spent: theme.colors.spentSoft,
  saved: theme.colors.secondary,
  due: theme.colors.idGoldDeep,
  free: theme.colors.primary,
};
/** The moon-cream face inside the ring. */
const FACE = '#FBF3DA';
/** The gap left between two slices, along the ring. */
const GAP = 3.5;
const DIM = 0.28;
const LAYERS = ['spent', 'saved', 'due', 'free'] as const;

/**
 * Home's month ring: income split into spent/savings/free arcs by share, headline on the cream face. Tap
 * steps slices (picked keeps colour). Stroke/type scale with `size`; arcs animate in unless reduce motion.
 */
export function MonthRing({
  slices,
  mode,
  big,
  label,
  size,
  periodKey,
  onPress,
  accessibilityLabel,
}: {
  slices: HeroSlices;
  /** 'kept' (the resting view) leaves every slice at full strength. */
  mode: HeroMode;
  /** The figure on the face: "51%", "Over", "—". */
  big: string;
  /** The word under it: "kept", "spent", … — empty for none. */
  label: string;
  size: number;
  /** A new period redraws the slices from nothing. */
  periodKey: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const reduce = useReduceMotion();
  const draw = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withTiming(1, timing(MOTION.draw));
  }, [periodKey, reduce, draw]);

  const compact = size < 90;
  const STROKE = compact ? 7 : 9;
  const c = size / 2;
  const r = c - STROKE / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const present = LAYERS.filter((k) => (slices[k] ?? 0) > 0).length;
  // Each slice starts where the ones before it end.
  const arcs = LAYERS.map((k, i) => {
    const share = slices[k] ?? 0;
    const before = LAYERS.slice(0, i).reduce((sum, prev) => sum + (slices[prev] ?? 0) * circumference, 0);
    const len = share > 0 ? Math.max(0, share * circumference - (present > 1 ? GAP : 0)) : 0;
    return { key: k, len, offset: before, opacity: mode === 'kept' || mode === k ? 1 : DIM };
  });

  return (
    <Pressable
      onPress={onPress}
      style={withPressed({ width: size, height: size })}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Steps through what was spent, saved and left"
    >
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={theme.colors.surfaceAlt} strokeWidth={STROKE} fill="none" />
        <Circle cx={c} cy={c} r={r - STROKE / 2 - (compact ? 4 : 5)} fill={FACE} />
        <G rotation={-90} origin={`${c}, ${c}`}>
          {arcs.map((a) =>
            a.len > 0 ? (
              <Arc
                key={a.key}
                c={c}
                r={r}
                stroke={STROKE}
                len={a.len}
                offset={a.offset}
                circumference={circumference}
                color={RING_COLORS[a.key]}
                opacity={a.opacity}
                draw={draw}
              />
            ) : null
          )}
        </G>
      </Svg>
      <View style={[styles.face, { paddingHorizontal: compact ? 13 : 22 }]} pointerEvents="none">
        <Text style={compact ? styles.bigCompact : styles.big} numberOfLines={1} adjustsFontSizeToFit>
          {big}
        </Text>
        {label !== '' && (
          <Text style={compact ? styles.labelCompact : styles.label} numberOfLines={1}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function Arc({
  c,
  r,
  stroke,
  len,
  offset,
  circumference,
  color,
  opacity,
  draw,
}: {
  c: number;
  r: number;
  stroke: number;
  len: number;
  offset: number;
  circumference: number;
  color: string;
  opacity: number;
  draw: SharedValue<number>;
}) {
  // Each slice grows along its own stretch of the ring.
  const props = useAnimatedProps(() => ({
    strokeDasharray: [len * draw.value, circumference],
  }));
  return (
    <AnimatedCircle
      cx={c}
      cy={c}
      r={r}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      fill="none"
      strokeDashoffset={-offset}
      opacity={opacity}
      animatedProps={props}
    />
  );
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  big: { fontFamily: theme.font.roundedBold, fontSize: 25, lineHeight: 28, color: theme.colors.textPrimary },
  label: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  bigCompact: {
    fontFamily: theme.font.roundedBold,
    fontSize: 17,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  labelCompact: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
});
