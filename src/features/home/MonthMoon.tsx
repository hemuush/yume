import { useEffect, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { DURATIONS } from '@/lib/motionTimings';
import { useEasedNumbers } from '@/lib/useEasedNumbers';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { HeroSlices, heroPct } from './heroSlices';
import { homeInk } from './homeInk';
import { moonLitPath, ringArcs } from './moonPhase';

const VIEW = 136;
const C = VIEW / 2;
const RING_R = 61;
const MOON_R = 45;
/** The ring's length: `ringArcs` works in percent of it. */
const CIRCUMFERENCE = 2 * Math.PI * RING_R;
/** Three slow breaths of the halo when the moon first appears, then it rests (as Suu does). */
const HALO_BREATHS = 3;

/**
 * The month as a moon. The ring is where income went (spent, saved, still to pay, free) in the colours used
 * everywhere on Home; the moon inside is lit by how much was kept: savings plus what is free. Spend and it
 * wanes, save and it grows. Both glide to new figures, also while the day rail is being dragged.
 */
export function MonthMoon({
  slices,
  size = 120,
  keptLabel = 'kept',
}: {
  slices: HeroSlices;
  size?: number;
  /** What the lit share is called: "kept", or "free" while savings are hidden. */
  keptLabel?: string;
}) {
  const { accent } = useAccent();
  const reduce = useReduceMotion();
  const [spent, saved, due, free] = useEasedNumbers(
    [slices.spent, slices.saved, slices.due ?? 0, slices.free],
    DURATIONS.draw + 80
  );
  const arcs = ringArcs([spent, saved, due, free]);
  const kept = Math.min(1, Math.max(0, saved + free));
  const lit = moonLitPath(kept, C, C, MOON_R);
  const colors = [
    theme.colors.slice.spent,
    theme.colors.slice.saved,
    theme.colors.slice.due,
    theme.colors.slice.free,
  ];
  const share = heroPct(slices.saved + slices.free);

  const [breath] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
      { iterations: HALO_BREATHS }
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, breath]);
  const haloStyle = {
    opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] }),
    transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
  };

  return (
    <View
      style={[styles.wrap, { width: size }]}
      accessible
      accessibilityLabel={`${share} of income ${keptLabel}`}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { height: size }, haloStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Defs>
            <RadialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.45" stopColor={theme.colors.moon.halo} stopOpacity={0.55} />
              <Stop offset="1" stopColor={theme.colors.moon.halo} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={C} cy={C} r={C - 8} fill="url(#moonHalo)" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Defs>
          <LinearGradient id="moonLit" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.colors.moon.lit} />
            <Stop offset="1" stopColor={theme.colors.moon.litEdge} />
          </LinearGradient>
          <ClipPath id="moonClip">
            <Path d={lit || `M${C} ${C}`} />
          </ClipPath>
        </Defs>
        <Circle cx={C} cy={C} r={RING_R} fill="none" stroke={theme.colors.surfaceAlt} strokeWidth={9} />
        <G rotation={-90} originX={C} originY={C}>
          {arcs.map((arc, i) => (
            <Circle
              key={i}
              cx={C}
              cy={C}
              r={RING_R}
              fill="none"
              stroke={colors[i]}
              strokeWidth={9}
              strokeDasharray={`${(arc.len / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={(arc.offset / 100) * CIRCUMFERENCE}
            />
          ))}
        </G>
        <Circle cx={C} cy={C} r={MOON_R} fill={homeInk(accent)} />
        {lit !== '' && <Path d={lit} fill="url(#moonLit)" />}
        {lit !== '' && (
          <G clipPath="url(#moonClip)" opacity={0.2}>
            <Circle cx={80} cy={54} r={7} fill={theme.colors.moon.crater} />
            <Circle cx={88} cy={82} r={4.5} fill={theme.colors.moon.crater} />
            <Circle cx={72} cy={92} r={3.2} fill={theme.colors.moon.crater} />
            <Circle cx={96} cy={64} r={2.4} fill={theme.colors.moon.crater} />
          </G>
        )}
      </Svg>
      <Text style={styles.caption}>
        {share} {keptLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', flexShrink: 0 },
  caption: {
    marginTop: 2,
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textSecondary,
  },
});
