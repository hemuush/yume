import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Skeleton } from '@/components/Skeleton';
import { Glass, GLASS } from '@/components/Glass';
import { GrowFill } from '@/components/GrowFill';
import { Kicker, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { payoffMonthShort } from '@/lib/loanPayoff';
import { loanBarTone } from './loanIdentity';
import type { DebtShare, LoanTotals } from './loanTotals';
import type { Timeline } from './timelineLayout';

function Stat({ value, label, lent }: { value: string; label: string; lent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, lent && styles.statLent]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * First card on Loans, the road to debt-free: what you owe, how much is repaid, and the same timeline Plan
 * shows (one line per loan, ending the month it finishes). With no end dates it falls back to the debt
 * split bar. Then EMIs a month, interest still to pay, the loan count and anything owed to you. Paid off,
 * or only lending, it says so instead.
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
  if (loading) {
    return (
      <Glass key="loading" radius={28} tone="strong" style={frost.hero}>
        <Skeleton width={70} height={10} radius={4} />
        <Skeleton width={160} height={28} radius={6} />
        <Skeleton width={200} height={14} radius={5} />
      </Glass>
    );
  }

  const owes = totals.youOweMinor > 0;
  const onlyLent = !owes && totals.owedToYouMinor > 0;
  const allClear = !owes && !onlyLent;
  const tone = (id: string) => loanBarTone(hues[id] ?? theme.colors.idGold);
  // The timeline only when it covers every loan you owe on; a loan with no end date left (say, only overdue
  // EMIs) would drop out of it, so the split bar, which shows them all, stays instead.
  const showLanes =
    !!timeline && timeline.rows.length > 0 && shares.every((s) => timeline.rows.some((r) => r.id === s.id));

  return (
    <Glass key="hero" radius={28} tone="strong" style={frost.hero}>
      {allClear ? (
        <>
          <Kicker icon="check">Debt-free</Kicker>
          <Text style={styles.title}>Everything is paid off</Text>
          <Text style={frost.sub}>
            {totals.closedCount} {totals.closedCount === 1 ? 'loan' : 'loans'} closed
          </Text>
        </>
      ) : (
        <>
          <View style={frost.heroRow}>
            <View style={frost.heroMain}>
              <Kicker icon={onlyLent ? 'users' : 'flag'}>{onlyLent ? 'Owed to you' : 'You owe'}</Kicker>
              <CountUpAmount
                minor={onlyLent ? totals.owedToYouMinor : totals.youOweMinor}
                symbolStyle={frost.bigSymbol}
                style={[frost.bigValue, onlyLent && { color: theme.colors.incomeText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </View>
            {owes && (
              <View style={frost.side}>
                {totals.debtFreeDate && (
                  <>
                    <Text style={frost.sideLabel}>Debt-free</Text>
                    <Text style={frost.sideValue} numberOfLines={1}>
                      {payoffMonthShort(totals.debtFreeDate)}
                    </Text>
                  </>
                )}
                <Text style={styles.sideNote} numberOfLines={1}>
                  <Text style={frost.subBold}>{formatRatioPct(totals.repaidFraction)}</Text> repaid
                </Text>
              </View>
            )}
          </View>

          {owes && showLanes ? (
            <View style={styles.lanes}>
              {timeline!.rows.map((row) => (
                <View key={row.id} style={styles.lane}>
                  <View style={styles.laneHead}>
                    <Text style={styles.laneName} numberOfLines={1}>
                      {row.name}
                    </Text>
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
          ) : (
            owes &&
            shares.length > 0 && (
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
            )
          )}

          <View style={styles.stats}>
            {owes && <Stat value={formatMoney(totals.emiPerMonthMinor)} label="EMIs a month" />}
            {owes && totals.interestLeftMinor > 0 && (
              <Stat value={formatMoney(totals.interestLeftMinor)} label="interest still to pay" />
            )}
            <Stat
              value={String(totals.activeCount)}
              label={totals.activeCount === 1 ? 'active loan' : 'active loans'}
            />
            {owes && totals.owedToYouMinor > 0 && (
              <Stat lent value={formatMoney(totals.owedToYouMinor)} label="owed to you" />
            )}
          </View>
        </>
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.font.roundedBold, fontSize: 17, color: theme.colors.textPrimary },
  sideNote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  lanes: { gap: 10, marginTop: 2 },
  lane: { gap: 5 },
  laneHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  laneName: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  laneDate: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textMuted },
  laneTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: GLASS.edge,
    overflow: 'hidden',
  },
  laneFill: { height: '100%', borderRadius: 5 },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(18,19,15,0.12)',
    borderStyle: 'dashed',
    paddingTop: 5,
  },
  axisText: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  axisEnd: { fontFamily: theme.font.bodyBold, color: theme.colors.incomeText },
  share: { flexDirection: 'row', gap: 3, height: 8 },
  segment: { flexBasis: 0, minWidth: 6, height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stat: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    gap: 2,
  },
  statValue: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  statLent: { color: theme.colors.incomeText },
  statLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
});
