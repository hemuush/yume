import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Rect, Mask, Defs, G } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { DURATIONS } from '@/lib/motionTimings';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { stageLabel, type GrowthStage } from '@/lib/gardenGrowth';

const STAGES: GrowthStage[] = ['seed', 'sprout', 'sapling', 'bloom'];
const STEM_HEIGHT = [0, 16, 21, 25];
const LEAF_SCALE = [0, 0.55, 0.8, 1];

/** Each half of the pop when a plant reaches a new stage: up to 1.08, back to 1. */
const POP_HALF_MS = 160;

/** The stage each animated pot last showed while the app was open. */
const seenStage = new Map<string, number>();

/** A stage position (0 seed … 3 bloom, fractions in between) as stem height and leaf size. */
function shapeAt(pos: number): { stemH: number; leafScale: number } {
  const i = Math.max(0, Math.min(STAGES.length - 2, Math.floor(pos)));
  const k = Math.max(0, Math.min(1, pos - i));
  return {
    stemH: STEM_HEIGHT[i] + (STEM_HEIGHT[i + 1] - STEM_HEIGHT[i]) * k,
    leafScale: LEAF_SCALE[i] + (LEAF_SCALE[i + 1] - LEAF_SCALE[i]) * k,
  };
}

/**
 * One pot's plant in a fixed 44x56 viewBox scaled by `size`: the app icon's sprout redrawn per stage.
 * `seed` is near-nothing on purpose; with `animKey` a plant reaching a new stage pops once, never on a drop.
 */
export function GardenPlant({
  stage,
  size = 44,
  animKey,
  decorative = false,
}: {
  stage: GrowthStage;
  size?: number;
  animKey?: string;
  /** Hide it from screen readers when text beside it already names the stage (the legend). */
  decorative?: boolean;
}) {
  const label = decorative ? undefined : `${stageLabel(stage)} plant`;
  if (animKey) return <GrowingPlant stage={stage} size={size} animKey={animKey} label={label} />;
  return <PlantSvg pos={STAGES.indexOf(stage)} size={size} label={label} />;
}

function GrowingPlant({
  stage,
  size,
  animKey,
  label,
}: {
  stage: GrowthStage;
  size: number;
  animKey: string;
  label?: string;
}) {
  const reduce = useReduceMotion();
  const idx = STAGES.indexOf(stage);
  const [start] = useState(() => seenStage.get(animKey) ?? idx);
  const [pos, setPos] = useState(start);
  const [grow] = useState(() => new Animated.Value(start));
  const [pop] = useState(() => new Animated.Value(1));
  const shownIdx = useRef(start);

  useEffect(() => {
    const id = grow.addListener(({ value }) => setPos(value));
    return () => grow.removeListener(id);
  }, [grow]);

  useEffect(() => {
    seenStage.set(animKey, idx);
    const from = shownIdx.current;
    shownIdx.current = idx;
    if (reduce || idx <= from) {
      grow.stopAnimation();
      grow.setValue(idx);
      setPos(idx);
      return;
    }
    Animated.timing(grow, {
      toValue: idx,
      duration: DURATIONS.standard,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      Animated.sequence([
        Animated.timing(pop, {
          toValue: 1.08,
          duration: POP_HALF_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pop, {
          toValue: 1,
          duration: POP_HALF_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [animKey, idx, reduce, grow, pop]);

  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <PlantSvg pos={pos} size={size} label={label} />
    </Animated.View>
  );
}

function PlantSvg({ pos, size, label }: { pos: number; size: number; label?: string }) {
  // The crescent mask is referenced by id, and ids are document-wide: every bloom on the screen needs its own,
  // or they all resolve to the first one. useId yields ":r1:", which isn't safe inside url(#…).
  const maskId = `crescent-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { stemH, leafScale } = shapeAt(pos);
  const bloom = pos >= STAGES.length - 1 - 0.001;
  const seed = pos <= 0.001;
  const baseY = 56;
  const stemTopY = baseY - stemH;

  return (
    <Svg
      width={size}
      height={(size * 56) / 44}
      viewBox="0 0 44 56"
      accessible={label != null}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      {bloom && (
        <Defs>
          <Mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="44" height="56">
            <Rect x="0" y="0" width="44" height="56" fill="white" />
            <Circle cx={31} cy={13} r={15} fill="black" />
          </Mask>
        </Defs>
      )}
      {seed ? (
        <Circle cx={22} cy={baseY - 3} r={2.6} fill={theme.colors.ink} opacity={0.45} />
      ) : (
        <G>
          {bloom && <Circle cx={22} cy={13} r={15} fill={theme.colors.ink} mask={`url(#${maskId})`} />}
          <Rect x={21} y={stemTopY} width={2} height={stemH} fill={theme.colors.ink} />
          <Ellipse
            cx={22 - 8 * leafScale}
            cy={stemTopY + stemH * 0.42}
            rx={7 * leafScale}
            ry={11 * leafScale}
            fill={theme.colors.flatLime}
            transform={`rotate(-32 ${22 - 8 * leafScale} ${stemTopY + stemH * 0.42})`}
          />
          <Ellipse
            cx={22 + 8 * leafScale}
            cy={stemTopY + stemH * 0.42}
            rx={7 * leafScale}
            ry={11 * leafScale}
            fill={theme.colors.secondary}
            transform={`rotate(32 ${22 + 8 * leafScale} ${stemTopY + stemH * 0.42})`}
          />
        </G>
      )}
    </Svg>
  );
}
