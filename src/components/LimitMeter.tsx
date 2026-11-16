import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { GrowFill } from './GrowFill';
import { themedStyles, themedValue } from '@/theme/themedStyles';

export type LimitMeterTone = 'ok' | 'near' | 'over';

// One ink for every bar, red only once the limit is passed: how close it is shows in the words beside it, and the pace
// dot shows where an even pace would be today.
const TONE_FILL = themedValue<Record<LimitMeterTone, string>>(() => ({
  ok: theme.colors.ink,
  near: theme.colors.ink,
  over: theme.colors.expense,
}));

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
  height = 5,
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
  const clamped = Math.min(100, Math.max(0, pct));
  const fillStyle = [styles.fill, { backgroundColor: TONE_FILL[tone] }];
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]}>
      {animKey ? (
        <GrowFill animKey={animKey} pct={clamped} style={fillStyle} />
      ) : (
        <View style={[fillStyle, { width: `${clamped}%` }]} />
      )}
      {/* Where the fill would be today if the limit were spent evenly (budget pace): the coral dot. */}
      {marker != null && <View style={[styles.marker, { left: `${Math.min(100, Math.max(0, marker))}%` }]} />}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    // A soft filled track with a rounded fill — no outline, which on a cream
    // card read as an empty box with a square-ended bar inside it.
    track: {
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
    },
    fill: { height: '100%', borderRadius: theme.radius.pill, overflow: 'hidden' },
    marker: {
      position: 'absolute',
      top: -3,
      width: 11,
      height: 11,
      marginLeft: -5.5,
      borderRadius: 5.5,
      backgroundColor: theme.colors.coral,
    },
  })
);
