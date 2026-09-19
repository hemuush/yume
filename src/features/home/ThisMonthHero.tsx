import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Circle, Path } from 'react-native-svg';
import ReanimatedAnimated, {
  Easing,
  FadeIn,
  ReduceMotion,
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withDelay,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { useAccent } from '@/theme/AccentContext';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { SoftCard } from './SoftCard';
import { lunePath } from '../reports/MoonPhase';
import type { SuuLine } from './suuLine';

// Reanimated only in this file, never core RN `Animated` — mixing the two in
// one tree is the exact bug class that crashed BudgetRow/GoalCard/GoalChip
// in an earlier pass (see Skeleton.tsx's own comment on the same rule). The
// confetti burst and the drawn checkmark below used to be built on core
// `Animated`, nested inside this component's Reanimated slide wrapper.
const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);

interface HeroContent {
  incomeMinor: number;
  spentMinor: number;
  surplusMinor: number;
  outstandingLoansMinor: number;
  suu: SuuLine;
}

const MOON_SIZE = 128;
const CHECK_PATH_LENGTH = 22;
const CONFETTI_COLORS = [theme.colors.secondary, theme.colors.primary, theme.colors.idCoralDeep];

interface ConfettiPiece {
  color: string;
  angle: number;
  distance: number;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 8 }, (_, i) => ({
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    angle: -Math.PI / 2 + (Math.random() - 0.5) * 2.6,
    distance: 22 + Math.random() * 18,
  }));
}

function ConfettiDot({ progress, piece }: { progress: SharedValue<number>; piece: ConfettiPiece }) {
  const style = useAnimatedStyle(() => {
    const tx = interpolate(progress.value, [0, 1], [0, Math.cos(piece.angle) * piece.distance]);
    const ty = interpolate(
      progress.value,
      [0, 0.4, 1],
      [0, Math.sin(piece.angle) * piece.distance - 6, Math.sin(piece.angle) * piece.distance + 18]
    );
    const opacity = interpolate(progress.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]);
    const rotate = interpolate(progress.value, [0, 1], [0, 260]);
    return {
      opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${rotate}deg` }],
    };
  });
  return (
    <ReanimatedAnimated.View
      pointerEvents="none"
      style={[styles.confettiDot, { backgroundColor: piece.color }, style]}
    />
  );
}

/**
 * The month's headline — Suu's own ring, scaled up, standing in for the
 * "how much did I keep" chart instead of a generic bar or ring. Same lune
 * construction (`lunePath`) Reports' recurring/discretionary moon card
 * already draws, tested there — kept-fraction lit in mint, the rest in a
 * pale neutral, with the same coral dot that gives Suu its personality
 * everywhere else in the app riding the lit edge. Income/Spent, Suu's line,
 * and Surplus/Debt all sit underneath it as plain figures — colour lives in
 * the moon and in each number, never as a card-sized tinted fill, matching
 * the restraint `SoftCard`'s own neutral surfaces already use elsewhere on
 * Home.
 *
 * `periodKey`/`direction` and the lagged `displayed` state are unchanged
 * from the previous version of this component — see the long comment this
 * file used to carry on why a same-period data update must sync
 * immediately while only a genuine month change turns the page, and on the
 * stale-snapshot race the `commit`/`runId` guard below prevents.
 */
export function ThisMonthHero({
  periodKey,
  direction,
  incomeMinor,
  spentMinor,
  surplusMinor,
  outstandingLoansMinor,
  suu,
  celebrateDebtCleared = false,
}: HeroContent & {
  periodKey: string;
  direction: -1 | 0 | 1;
  /** Fires once on the real >0 → 0 crossing — see `justClearedDebt` in Home. */
  celebrateDebtCleared?: boolean;
}) {
  const reduce = useReduceMotion();
  const { dot } = useAccent();
  const [displayed, setDisplayed] = useState<HeroContent>({
    incomeMinor,
    spentMinor,
    surplusMinor,
    outstandingLoansMinor,
    suu,
  });
  const prevPeriodKey = useRef(periodKey);
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  const runId = useRef(0);

  useEffect(() => {
    const myRun = ++runId.current;
    const next: HeroContent = { incomeMinor, spentMinor, surplusMinor, outstandingLoansMinor, suu };
    const isPeriodTurn = prevPeriodKey.current !== periodKey;
    prevPeriodKey.current = periodKey;

    if (!isPeriodTurn || reduce) {
      setDisplayed(next);
      return;
    }
    const outX = direction > 0 ? -18 : direction < 0 ? 18 : 0;
    const inX = direction > 0 ? 18 : direction < 0 ? -18 : 0;
    const commit = () => {
      if (runId.current !== myRun) return;
      setDisplayed(next);
    };
    opacity.value = withTiming(0, { duration: 140 });
    tx.value = withTiming(outX, { duration: 140 }, (finished) => {
      if (!finished) return;
      runOnJS(commit)();
      tx.value = inX;
      tx.value = withTiming(0, { duration: 220 });
      opacity.value = withTiming(1, { duration: 220 });
    });
    // `suu` (an object) and `direction` deliberately excluded — including an
    // object recreated every render would re-fire this effect every render
    // too; the current values are read fresh via closure regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, incomeMinor, spentMinor, surplusMinor, outstandingLoansMinor, reduce]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  const hasIncome = displayed.incomeMinor > 0;
  const keptPct = hasIncome ? Math.max(0, Math.min(1, 1 - displayed.spentMinor / displayed.incomeMinor)) : 0;
  const warn = displayed.suu.pose === 'sleepy';
  const debtCleared = displayed.outstandingLoansMinor === 0;

  // Debt-cleared celebration — a drawn checkmark plus a small confetti
  // burst, played once on the real crossing (see Home's own comment on
  // `justClearedDebt`), not on every render where debt already happens to
  // be zero.
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [confettiPlaying, setConfettiPlaying] = useState(false);
  const checkDraw = useSharedValue(1);
  const confettiProgress = useSharedValue(0);
  useEffect(() => {
    if (!celebrateDebtCleared || reduce) return;
    setConfetti(makeConfetti());
    setConfettiPlaying(true);
    checkDraw.value = 0;
    confettiProgress.value = 0;
    checkDraw.value = withDelay(150, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    confettiProgress.value = withDelay(
      100,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setConfettiPlaying)(false);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateDebtCleared, reduce]);

  const checkAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(checkDraw.value, [0, 1], [CHECK_PATH_LENGTH, 0]),
  }));

  const r = MOON_SIZE / 2 - 3;
  const c = MOON_SIZE / 2;
  // The dot sits on the lit edge — at kept=0 that's the leftmost point of
  // the disc, sweeping clockwise to the top as more of the month is kept.
  const dotAngle = -Math.PI + keptPct * Math.PI;
  const dotX = c + Math.cos(dotAngle) * r;
  const dotY = c + Math.sin(dotAngle) * r * 0.55;

  return (
    <SoftCard elevated backgroundColor={theme.colors.surface} style={styles.card}>
      <Text style={styles.title}>This month</Text>

      <ReanimatedAnimated.View style={[styles.body, slideStyle]}>
        <View style={styles.moonWrap}>
          <ReanimatedAnimated.View
            key={hasIncome ? Math.round(keptPct * 100) : 'no-income'}
            entering={FadeIn.duration(700).springify().reduceMotion(ReduceMotion.System)}
          >
            <Svg width={MOON_SIZE} height={MOON_SIZE} viewBox={`0 0 ${MOON_SIZE} ${MOON_SIZE}`}>
              {/* The unlit side is "spent," not just empty — a plain neutral
                  tan there (an earlier pass) read as blank instead of the
                  other half of a split, and blended into both the card and
                  the page behind it. Coral mirrors the Income/Spent figures
                  right below, so kept/spent is legible from the moon alone.
                  A genuinely bad month doesn't need a colour swap on top of
                  this — spent > income already collapses the lit share to a
                  thin (or zero) mint sliver, so the shape carries that on
                  its own. */}
              <Circle cx={c} cy={c} r={r} fill={theme.colors.idCoral} />
              {hasIncome && <Path d={lunePath(c, c, r, keptPct)} fill={theme.colors.secondary} />}
              <Circle cx={c} cy={c} r={r} fill="none" stroke={theme.colors.borderSoft} strokeWidth={1.5} />
              {hasIncome && keptPct > 0.03 && <Circle cx={dotX} cy={dotY} r={5} fill={dot} />}
            </Svg>
          </ReanimatedAnimated.View>
          <View style={styles.moonCenter} pointerEvents="none">
            <Text style={styles.moonPct}>{hasIncome ? `${Math.round(keptPct * 100)}%` : '—'}</Text>
            <Text style={styles.moonPctLabel}>kept</Text>
          </View>
        </View>

        <View style={styles.figsRow}>
          <View style={styles.fig}>
            <Text style={styles.figLabel}>Income</Text>
            <Text style={[styles.figVal, { color: theme.colors.income }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(displayed.incomeMinor)}
            </Text>
          </View>
          <Text style={styles.figSep}>·</Text>
          <View style={styles.fig}>
            <Text style={styles.figLabel}>Spent</Text>
            <Text style={[styles.figVal, { color: theme.colors.idCoralDeep }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(displayed.spentMinor)}
            </Text>
          </View>
        </View>

        <View style={[styles.suuStrip, warn && styles.suuStripWarn]}>
          <Text style={[styles.suuStripText, warn && styles.suuStripTextWarn]}>{displayed.suu.text}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Feather
              name={displayed.surplusMinor >= 0 ? 'arrow-up' : 'arrow-down'}
              size={14}
              color={displayed.surplusMinor >= 0 ? theme.colors.income : theme.colors.expense}
            />
            <View style={styles.statText}>
              <Text style={styles.statLabel}>Surplus</Text>
              <Text
                style={[
                  styles.statVal,
                  { color: displayed.surplusMinor >= 0 ? theme.colors.income : theme.colors.expense },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(displayed.surplusMinor)}
              </Text>
            </View>
          </View>
          <View style={styles.statSep} />
          <View style={styles.stat}>
            <Feather name="credit-card" size={14} color={theme.colors.textPrimary} />
            <View style={styles.statText}>
              <View style={styles.statLabelRow}>
                <Text style={styles.statLabel}>Debt left</Text>
                {debtCleared && (
                  <Svg width={10} height={10} viewBox="0 0 24 24" style={styles.checkIcon}>
                    <AnimatedPath
                      d="M5 13l4 4 10-10"
                      stroke={theme.colors.income}
                      strokeWidth={3.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      strokeDasharray={CHECK_PATH_LENGTH}
                      animatedProps={checkAnimatedProps}
                    />
                  </Svg>
                )}
              </View>
              <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(displayed.outstandingLoansMinor)}
              </Text>
            </View>
            {confettiPlaying &&
              confetti.map((piece, i) => <ConfettiDot key={i} progress={confettiProgress} piece={piece} />)}
          </View>
        </View>
      </ReanimatedAnimated.View>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 4 },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 13,
    letterSpacing: 0.3,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  body: { marginTop: 8, alignItems: 'center' },

  moonWrap: { width: MOON_SIZE, height: MOON_SIZE, marginTop: 6 },
  moonCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MOON_SIZE,
    height: MOON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonPct: { fontFamily: theme.font.monoBold, fontSize: 24, color: theme.colors.textPrimary },
  moonPctLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  },

  figsRow: { flexDirection: 'row', gap: 12, marginTop: 12, alignItems: 'center' },
  fig: { alignItems: 'center' },
  figLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 9,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  figVal: { fontFamily: theme.font.monoBold, fontSize: 14, marginTop: 2 },
  figSep: { color: theme.colors.borderSoft, fontFamily: theme.font.monoBold, fontSize: 14 },

  suuStrip: { marginTop: 10, paddingHorizontal: 8 },
  suuStripText: {
    fontFamily: theme.font.rounded,
    fontSize: 11.5,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  suuStripWarn: {},
  suuStripTextWarn: { color: theme.colors.idCoralDeep, fontFamily: theme.font.roundedMedium },

  divider: { height: 1, backgroundColor: theme.colors.borderSoft, marginTop: 14, alignSelf: 'stretch' },

  statRow: { flexDirection: 'row', marginTop: 12, alignSelf: 'stretch' },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  statText: { flex: 1, minWidth: 0 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  statVal: { fontFamily: theme.font.monoBold, fontSize: 13.5, color: theme.colors.textPrimary },
  statSep: { width: 1, backgroundColor: theme.colors.borderSoft, marginHorizontal: 14 },
  checkIcon: {},

  confettiDot: {
    position: 'absolute',
    top: 4,
    left: '50%',
    width: 5,
    height: 5,
    borderRadius: 1,
    marginLeft: -2.5,
  },
});
