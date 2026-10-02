import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import type { McIconName } from '@/components/iconName';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { payoffMonth } from '@/lib/loanPayoff';
import { loanBarTone, loanGlyph, loanTint } from './loanIdentity';
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
 * The first block on Loans: what you owe, when you'll be free of it, how that
 * debt splits across your loans (the bar, in each loan's own colour), and the
 * numbers the cards don't add up for you (EMIs a month, interest still to
 * pay, how many loans). Money lent shows as its own figure, only when there is some.
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
      <View key="loading" style={styles.card}>
        <Skeleton width={70} height={10} radius={4} />
        <Skeleton width={160} height={28} radius={6} style={{ marginTop: 10 }} />
        <Skeleton width={200} height={14} radius={5} style={{ marginTop: 10 }} />
      </View>
    );
  }

  const owes = totals.youOweMinor > 0;
  const onlyLent = !owes && totals.owedToYouMinor > 0;
  const allClear = !owes && !onlyLent;
  const tile = onlyLent ? theme.colors.secondary : allClear ? theme.colors.idSage : theme.colors.idCoral;
  const icon: McIconName = onlyLent ? 'hand-coin-outline' : allClear ? 'check' : 'bank-outline';

  return (
    <View key="hero" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          {allClear ? (
            <>
              <Text style={styles.kicker}>Debt-free</Text>
              <Text style={styles.title}>Everything is paid off</Text>
              <Text style={styles.sub}>
                {totals.closedCount} {totals.closedCount === 1 ? 'loan' : 'loans'} closed
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.kicker}>{onlyLent ? 'Owed to you' : 'You owe'}</Text>
              <CountUpAmount
                minor={onlyLent ? totals.owedToYouMinor : totals.youOweMinor}
                style={styles.amount}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
              {owes && totals.debtFreeDate && (
                <Text style={styles.title}>Debt-free {payoffMonth(totals.debtFreeDate)}</Text>
              )}
            </>
          )}
        </View>
        <View style={[styles.tile, { backgroundColor: loanTint(tile) }]}>
          <MaterialCommunityIcons name={icon} size={18} color={loanGlyph(tile)} />
        </View>
      </View>

      {owes && shares.length > 0 && (
        <>
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
          <Text style={styles.caption}>
            <Text style={styles.captionBold}>{formatRatioPct(totals.repaidFraction)}</Text> repaid overall ·
            the bar shows your debt by loan
          </Text>
        </>
      )}

      {!allClear && (
        <>
          <View style={styles.divider} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 4,
    padding: 16,
    borderRadius: theme.radius.xl2,
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
  kicker: { ...EYEBROW },
  amount: { fontFamily: theme.font.monoBold, fontSize: 30, color: theme.colors.textPrimary, marginTop: 6 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  share: { flexDirection: 'row', gap: 3, height: 10, marginTop: 14 },
  segment: { flexBasis: 0, minWidth: 6, height: 10, borderRadius: 5 },
  caption: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 8 },
  captionBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderSoft, marginVertical: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 10 },
  stat: { gap: 2 },
  statValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  statLent: { color: theme.colors.incomeText },
  statLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
});
