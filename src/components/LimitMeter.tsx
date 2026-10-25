import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { GrowFill } from './GrowFill';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';

export type LimitMeterTone = 'ok' | 'near' | 'over';

// 'ok' follows the picked theme's secondary, a deeper shade so it shows on the track (read in the component).
const TONE_FILL: Record<Exclude<LimitMeterTone, 'ok'>, string> = {
  near: theme.colors.idGoldDeep,
  over: theme.colors.expense,
};

/**
 * The shared "share of a cap used" bar (Today's spending strip, every Budget row). ThisMonthHero's bar keeps
 * its own two-tone track: it shows a split summing to 100%, not a fill growing toward a cap.
 */
export function LimitMeter({
  pct,
  tone,
  marker,
  animKey,
  trackColor = theme.colors.surfaceAlt,
  height = 7,
}: {
  pct: number;
  tone: LimitMeterTone;
  marker?: number;
  /**
   * Meter identity (e.g. `budget:<id>`): the fill grows from its last width on the UI thread.
   * Without it the fill is drawn plain.
   */
  animKey?: string;
  /** The empty part of the bar; a lighter tone where the bar sits on a tinted card. */
  trackColor?: string;
  height?: number;
}) {
  const { secondary } = useAccent();
  const clamped = Math.min(100, Math.max(0, pct));
  const fillStyle = [
    styles.fill,
    { backgroundColor: tone === 'ok' ? shade(secondary, 66) : TONE_FILL[tone] },
  ];
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]}>
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
