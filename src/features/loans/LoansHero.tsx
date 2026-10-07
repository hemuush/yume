import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import type { McIconName } from '@/components/iconName';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Skeleton } from '@/components/Skeleton';
import { StripCard, KickerDot } from '@/components/StripCard';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { payoffMonthShort } from '@/lib/loanPayoff';
import { loanBarTone, loanGlyph } from './loanIdentity';
import type { DebtShare, LoanTotals } from './loanTotals';

function Stat({ value, label, lent }: { value: string; label: string; lent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, lent && styles.statLent]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * First block on Loans, tinted by state: coral while you owe, sage once paid off, mint when you only lend.
 * Owing: debt, debt-free month, repaid, debt-share bar, EMIs/month, interest left, loan count; lent if any.
 */
export function LoansHero({
  totals,
  shares,
  hues,
  loading,
}: {
  totals: LoanTotals;
  shares: DebtShare[];
  hues: Record<string, string>;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <View key="loading" style={[styles.card, styles.skeletonCard]}>
        <Skeleton width={70} height={10} radius={4} />
        <Skeleton width={160} height={28} radius={6} style={{ marginTop: 10 }} />
        <Skeleton width={200} height={14} radius={5} style={{ marginTop: 10 }} />
      </View>
    );
  }

  const owes = totals.youOweMinor > 0;
  const onlyLent = !owes && totals.owedToYouMinor > 0;
  const allClear = !owes && !onlyLent;
  const hue = onlyLent ? theme.colors.secondary : allClear ? theme.colors.idSage : theme.colors.idCoral;
  const icon: McIconName = onlyLent ? 'hand-coin-outline' : allClear ? 'check' : 'bank-outline';
  // The strip says which way the money goes: coral while you owe, mint when you're owed or all clear.
  const strip = owes ? theme.colors.slice.spent : theme.colors.slice.saved;
  const dot = owes ? theme.colors.idCoralDeep : theme.colors.secondaryDeep;
  const kicker = (text: string) => (
    <View style={styles.kickerRow}>
      <KickerDot color={dot} />
      <Text style={styles.kicker}>{text}</Text>
    </View>
  );

  return (
    <StripCard key="hero" tone={strip} style={styles.card}>
      <View style={styles.head}>
        {!owes && (
          <View style={[styles.tile, { backgroundColor: shade(hue, 93) }]}>
            <MaterialCommunityIcons name={icon} size={18} color={loanGlyph(hue)} />
          </View>
        )}
        <View style={styles.headText}>
          {allClear ? (
            <>
              {kicker('Debt-free')}
              <Text style={styles.title}>Everything is paid off</Text>
              <Text style={styles.sub}>
                {totals.closedCount} {totals.closedCount === 1 ? 'loan' : 'loans'} closed
              </Text>
            </>
          ) : (
            <>
              {kicker(onlyLent ? 'Owed to you' : 'You owe')}
              <CountUpAmount
                minor={onlyLent ? totals.owedToYouMinor : totals.youOweMinor}
                style={styles.amount}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </>
          )}
        </View>
        {owes && (
          <View style={styles.side}>
            {totals.debtFreeDate && (
              <>
                <Text style={styles.sideLabel}>Debt-free</Text>
                <Text style={styles.sideValue} numberOfLines={1}>
                  {payoffMonthShort(totals.debtFreeDate)}
                </Text>
              </>
            )}
            <Text style={styles.sideNote} numberOfLines={1}>
              <Text style={styles.sideNoteBold}>{formatRatioPct(totals.repaidFraction)}</Text> repaid
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
              style={[
                styles.segment,
                { flexGrow: s.fraction, backgroundColor: loanBarTone(hues[s.id] ?? theme.colors.idGold) },
              ]}
            />
          ))}
        </View>
      )}

      {!allClear && (
        <>
          {!owes && <View style={styles.divider} />}
          <View style={[styles.stats, owes && styles.statsOwing]}>
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
    </StripCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 4,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  skeletonCard: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 38 * 0.32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 26, color: theme.colors.textPrimary, marginTop: 2 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  side: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  sideLabel: { ...EYEBROW, color: theme.colors.textSecondary },
  sideValue: {
    fontFamily: theme.font.roundedBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  sideNote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  sideNoteBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  share: { flexDirection: 'row', gap: 3, height: 8, marginTop: 10 },
  segment: { flexBasis: 0, minWidth: 6, height: 8, borderRadius: 4 },
  divider: { height: 1, backgroundColor: theme.colors.divider, marginVertical: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 10 },
  // Set off from the figures above by a line, as on Home's month card.
  statsOwing: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  stat: { gap: 2 },
  statValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  statLent: { color: theme.colors.incomeText },
  statLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textSecondary },
});
