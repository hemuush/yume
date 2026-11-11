import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Skeleton } from '@/components/Skeleton';
import { GLASS } from '@/components/Glass';
import { InsightDisclosure } from '@/components/InsightCard';
import { GrowFill } from '@/components/GrowFill';
import { Kicker } from '@/components/Frost';
import { SCREEN, screenStyles } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { payoffMonthShort } from '@/lib/loanPayoff';
import { loanBarTone } from './loanIdentity';
import type { DebtShare, LoanTotals } from './loanTotals';
import type { Timeline } from './timelineLayout';

interface Fact {
  label: string;
  value: string;
  good?: boolean;
}

/**
 * First card on Loans, the same flat summary card as Home, Activity and Reports. What you owe, with the
 * debt-free month and the repaid share beside it; the split of that debt in each loan's own colour (the same
 * colour as its card below); EMIs a month, interest still to pay and anything owed to you as small facts; and
 * the payoff timeline, one line per loan, behind a disclosure. Paid off, or only lending, it says so instead.
 */
export function LoansHero({
  totals,
  shares,
  hues,
  timeline,
  loading,
}: {
  totals: LoanTotals;
  shares: DebtShare[];
  hues: Record<string, string>;
  /** Borrowed loans laid out from today to the last EMI; null when none has an end date. */
  timeline?: Timeline | null;
  loading?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  if (loading) {
    return (
      <View key="loading" style={[screenStyles.card, styles.hero]}>
        <Skeleton width={70} height={10} radius={4} />
        <Skeleton width={160} height={22} radius={6} />
        <Skeleton width={200} height={14} radius={5} />
      </View>
    );
  }

  const owes = totals.youOweMinor > 0;
  const onlyLent = !owes && totals.owedToYouMinor > 0;
  const allClear = !owes && !onlyLent;
  const tone = (id: string) => loanBarTone(hues[id] ?? theme.colors.idGold);
  // The timeline only when it covers every loan you owe on; a loan with no end date left (say, only overdue
  // EMIs) would drop out of it, so it is left out and the split bar, which shows them all, carries the card.
  const showLanes =
    !!timeline && timeline.rows.length > 0 && shares.every((s) => timeline.rows.some((r) => r.id === s.id));
  const facts: Fact[] = owes
    ? [
        { label: 'EMIs a month', value: formatMoney(totals.emiPerMonthMinor) },
        ...(totals.interestLeftMinor > 0
          ? [{ label: 'Interest to go', value: formatMoney(totals.interestLeftMinor) }]
          : []),
        ...(totals.owedToYouMinor > 0
          ? [{ label: 'Owed to you', value: formatMoney(totals.owedToYouMinor), good: true }]
          : []),
      ]
    : onlyLent
      ? [
          {
            label: totals.activeCount === 1 ? 'Active loan' : 'Active loans',
            value: String(totals.activeCount),
          },
        ]
      : [];
  // A fact's column grows with the text size, so a figure keeps its width and the facts wrap instead.
  const factBasis = Math.round(84 * Math.min(2, Math.max(1, fontScale)));

  return (
    <View key="hero" style={[screenStyles.card, styles.hero]}>
      {allClear ? (
        <View style={styles.clear}>
          <Kicker icon="check">Debt-free</Kicker>
          <Text style={styles.title}>Everything is paid off</Text>
          <Text style={styles.clearSub}>
            {totals.closedCount} {totals.closedCount === 1 ? 'loan' : 'loans'} closed
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.top}>
            <View style={styles.topMain}>
              <Text style={styles.label}>{onlyLent ? 'Owed to you' : 'You owe'}</Text>
              <CountUpAmount
                minor={onlyLent ? totals.owedToYouMinor : totals.youOweMinor}
                style={[styles.figure, onlyLent && { color: theme.colors.incomeText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </View>
            {owes && (
              <View style={styles.side}>
                {totals.debtFreeDate && (
                  <Text style={styles.sideMain}>Debt-free {payoffMonthShort(totals.debtFreeDate)}</Text>
                )}
                <Text style={styles.sideNote} numberOfLines={1}>
                  <Text style={styles.sideBold}>{formatRatioPct(totals.repaidFraction)}</Text> repaid so far
                </Text>
              </View>
            )}
          </View>

          {owes && shares.length > 0 && (
            <View
              style={styles.share}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {shares.map((s) => (
                <View
                  key={s.id}
                  style={[styles.segment, { flexGrow: s.fraction, backgroundColor: tone(s.id) }]}
                />
              ))}
            </View>
          )}

          {facts.length > 0 && (
            <View style={styles.facts}>
              {facts.map((fact) => (
                <View key={fact.label} style={[styles.fact, { flexBasis: factBasis }]}>
                  <Text style={styles.factLabel}>{fact.label}</Text>
                  <Text style={[styles.factValue, fact.good && styles.good]}>{fact.value}</Text>
                </View>
              ))}
            </View>
          )}
          {owes && !totals.debtFreeDate && (
            <Text style={styles.note}>A complete payoff schedule is not available for every loan.</Text>
          )}

          {owes && showLanes && (
            <View style={styles.timeline}>
              <InsightDisclosure title="Payoff timeline">
                <View style={styles.lanes}>
                  {timeline!.rows.map((row) => (
                    <View key={row.id} style={styles.lane}>
                      <View style={styles.laneHead}>
                        <Text style={styles.laneName}>{row.name}</Text>
                        <Text style={styles.laneDate}>{payoffMonthShort(row.endDate)}</Text>
                      </View>
                      <View style={styles.laneTrack}>
                        <GrowFill
                          animKey={`loan-timeline:${row.id}`}
                          pct={row.fraction * 100}
                          style={[styles.laneFill, { backgroundColor: tone(row.id) }]}
                        />
                      </View>
                    </View>
                  ))}
                  <View
                    style={styles.axis}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Text style={styles.axisText}>Now</Text>
                    {timeline!.midYear !== null && <Text style={styles.axisText}>{timeline!.midYear}</Text>}
                    <Text style={[styles.axisText, styles.axisEnd]}>Debt-free {timeline!.endYear}</Text>
                  </View>
                </View>
              </InsightDisclosure>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The flat card the other screens lead with; one lifted element over a list of flat ones.
  hero: {
    marginHorizontal: SCREEN.gutter,
    marginTop: theme.layout.screenTopGap,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 8px 24px rgba(18,19,15,0.05)',
    overflow: 'visible',
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
    paddingHorizontal: 2,
  },
  topMain: { flexShrink: 1, minWidth: 0 },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  side: { flexShrink: 1, alignItems: 'flex-end' },
  sideMain: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  sideNote: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  sideBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  share: { flexDirection: 'row', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden' },
  segment: { flexBasis: 0, minWidth: 6, height: 8, borderRadius: 4 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8, paddingHorizontal: 2 },
  fact: { flexGrow: 1, minWidth: 0 },
  factLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  factValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  good: { color: theme.colors.incomeText },
  note: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  clear: { gap: 8, paddingBottom: 10 },
  clearSub: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  timeline: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  lanes: { gap: 10, paddingBottom: 10 },
  lane: { gap: 5 },
  laneHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 6,
  },
  laneName: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
  laneDate: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textMuted },
  laneTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.inkWash,
    overflow: 'hidden',
  },
  laneFill: { height: '100%', borderRadius: 4 },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: GLASS.edge,
    borderStyle: 'dashed',
    paddingTop: 6,
  },
  axisText: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  axisEnd: { fontFamily: theme.font.bodyBold, color: theme.colors.incomeText },
});
