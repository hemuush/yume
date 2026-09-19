import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

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
export function LimitMeter({ pct, tone }: { pct: number; tone: LimitMeterTone }) {
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: TONE_FILL[tone] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});
