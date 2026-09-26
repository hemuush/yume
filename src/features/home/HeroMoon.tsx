import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import ReanimatedAnimated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { MOTION, timing } from '@/lib/animation';
import type { HeroMode, HeroSlices } from './heroSlices';
import { spentRegion, savedRegion, freeRegion } from './moonPaths';

const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);

/** Slice colours — the figure rows beside the moon use the same three as their legend dots. */
export const MOON_COLORS = {
  spent: theme.colors.spentSoft,
  saved: theme.colors.secondary,
  free: theme.colors.primary,
};

const CX = 100;
const CY = 100;
const R = 76;
const DIM = 0.28;

const DISC = { cx: CX, cy: CY, r: R };

// A few soft craters, in the moon's own (untilted) coordinates.
const CRATERS: [number, number, number][] = [
  [74, 76, 9],
  [112, 128, 12],
  [128, 80, 6],
  [84, 124, 5],
  [104, 98, 4],
];

// "Kept" is the resting view: every slice at full strength. Picking a
// single slice fades the other two back so it stands out.
function targetOpacity(layer: 'spent' | 'saved' | 'free', mode: HeroMode): number {
  if (mode === 'kept') return 1;
  return layer === mode ? 1 : DIM;
}

/**
 * Home's month drawn as a real moon phase — the sign-off's option B. The
 * disc is the period's income: the dark side is what was spent, the lit
 * side what was kept, and within the lit side the outermost sliver is what's
 * still free to use (the rest went to savings). The three are separate,
 * non-overlapping regions bounded by area-true terminators (moonPaths.ts),
 * so each slice's share of the disc is its share of income.
 *
 * Tilted and given a glow, soft craters and a little shading so it reads as
 * a moon at any phase — a plain half-lit disc (most months land near 50%
 * kept) otherwise looks like a pie. The phase grows in from new moon on
 * first show and waxes/wanes into a new period's shape; the highlighted
 * slice fades the other two back. Reduce-motion jumps straight to the end.
 */
export function HeroMoon({
  slices,
  mode,
  size = 190,
  onPress,
  accessibilityLabel,
}: {
  slices: HeroSlices;
  mode: HeroMode;
  size?: number;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const reduce = useReduceMotion();
  const keptK = useSharedValue(0);
  const freeK = useSharedValue(0);
  const spentO = useSharedValue(1);
  const savedO = useSharedValue(1);
  const freeO = useSharedValue(1);

  const keptTarget = slices.saved + slices.free;
  const freeTarget = slices.free;
  useEffect(() => {
    if (reduce) {
      keptK.value = keptTarget;
      freeK.value = freeTarget;
      return;
    }
    const cfg = timing(MOTION.draw);
    keptK.value = withTiming(keptTarget, cfg);
    freeK.value = withTiming(freeTarget, cfg);
  }, [keptTarget, freeTarget, reduce, keptK, freeK]);

  useEffect(() => {
    const set = (v: typeof spentO, to: number) => {
      v.value = reduce ? to : withTiming(to, timing(MOTION.quick));
    };
    set(spentO, targetOpacity('spent', mode));
    set(savedO, targetOpacity('saved', mode));
    set(freeO, targetOpacity('free', mode));
  }, [mode, reduce, spentO, savedO, freeO]);

  const spentProps = useAnimatedProps(() => ({ d: spentRegion(DISC, keptK.value), opacity: spentO.value }));
  const savedProps = useAnimatedProps(() => ({
    d: savedRegion(DISC, keptK.value, freeK.value),
    opacity: savedO.value,
  }));
  const freeProps = useAnimatedProps(() => ({ d: freeRegion(DISC, freeK.value), opacity: freeO.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Shows the next slice"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="moonGlow" cx="100" cy="100" r="98" gradientUnits="userSpaceOnUse">
            <Stop offset="0.55" stopColor={theme.colors.primary} stopOpacity={0.35} />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="moonShade" cx="38%" cy="34%" r="70%">
            <Stop offset="0" stopColor={theme.colors.white} stopOpacity={0.35} />
            <Stop offset="1" stopColor={theme.colors.ink} stopOpacity={0.06} />
          </RadialGradient>
        </Defs>
        <Circle cx={CX} cy={CY} r={98} fill="url(#moonGlow)" />
        <G transform={`rotate(-22 ${CX} ${CY})`}>
          {/* A neutral disc under the three regions — fills the hairline
              anti-aliasing seams between them, and is the whole moon when
              there's no income to split. */}
          <Circle cx={CX} cy={CY} r={R} fill={theme.colors.surfaceAlt} />
          {slices.hasIncome && (
            <>
              <AnimatedPath fill={MOON_COLORS.spent} animatedProps={spentProps} />
              <AnimatedPath fill={MOON_COLORS.saved} animatedProps={savedProps} />
              <AnimatedPath fill={MOON_COLORS.free} animatedProps={freeProps} />
            </>
          )}
          {CRATERS.map(([x, y, r]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={theme.colors.ink} opacity={0.05} />
          ))}
          <Circle cx={CX} cy={CY} r={R} fill="url(#moonShade)" />
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={theme.colors.ink}
            strokeOpacity={0.12}
            strokeWidth={1.2}
          />
        </G>
      </Svg>
    </Pressable>
  );
}
