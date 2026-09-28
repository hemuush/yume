import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { GrowFill } from './GrowFill';

export type LimitMeterTone = 'ok' | 'near' | 'over';

const TONE_FILL: Record<LimitMeterTone, string> = {
  ok: theme.colors.secondary,
  near: theme.colors.idGoldDeep,
  over: theme.colors.expense,
};

/**
 * The shared "share of a cap used" bar — Today's spending strip and every
 * Budget row both draw this exact same fact (how much of a limit is gone)
 * but used to do it with three different heights/radii/borders between
 * them (and a fourth in ThisMonthHero's own bar). That one drew a genuinely
 * different fact — a composition split between two things that always sum
 * to 100%, not a single fill growing toward a cap — so it keeps its own
 * two-tone track rather than moving to this component; this one is only for
 * the "used vs. a limit" shape, wherever that shows up.
 */
export function LimitMeter({
  pct,
  tone,
  marker,
  animKey,
}: {
  pct: number;
  tone: LimitMeterTone;
  marker?: number;
  /**
   * Which meter this is (e.g. `budget:<id>`): the fill then grows from the
   * width it last showed instead of snapping (useGrowFrom). Without it the
   * fill is drawn plain.
   */
  animKey?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const fillStyle = [styles.fill, { backgroundColor: TONE_FILL[tone] }];
  return (
    <View style={styles.track}>
      {animKey ? (
        <GrowFill animKey={animKey} pct={clamped} style={fillStyle} />
      ) : (
        <View style={[fillStyle, { width: `${clamped}%` }]} />
      )}
      {/* Where the fill would be today if the limit were spent evenly (budget pace). */}
      {marker != null && <View style={[styles.marker, { left: `${Math.min(100, Math.max(0, marker))}%` }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // A soft filled track with a rounded fill — no outline, which on a cream
  // card read as an empty box with a square-ended bar inside it.
  track: {
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: theme.radius.pill },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: theme.colors.ink,
  },
});
