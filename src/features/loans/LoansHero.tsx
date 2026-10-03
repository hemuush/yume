import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import type { McIconName } from '@/components/iconName';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Skeleton } from '@/components/Skeleton';
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
 * The first block on Loans, tinted by state: coral while you owe, sage once
 * everything is paid off, mint when you only lend. While you owe it shows the
 * debt, the debt-free month and how much is repaid, how the debt splits across
 * your loans (the bar, in each loan's own colour), and the numbers the cards
 * don't add up for you (EMIs a month, interest still to pay, how many loans).
 * Money lent shows as its own figure, only when there is some.
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

  return (
    <View key="hero" style={[styles.card, { backgroundColor: shade(hue, 93) }]}>
      <LinearGradient
        colors={[shade(hue, 93), shade(hue, 85)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.circle} />
      <View style={styles.head}>
        {!owes && (
          <View style={styles.tile}>
            <MaterialCommunityIcons name={icon} size={18} color={loanGlyph(hue)} />
          </View>
        )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  skeletonCard: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  circle: {
    position: 'absolute',
    right: -34,
    top: -46,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 38 * 0.32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
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
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginVertical: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 10 },
  statsOwing: { marginTop: 10 },
  stat: { gap: 2 },
  statValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  statLent: { color: theme.colors.incomeText },
  statLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textSecondary },
});
