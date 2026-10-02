import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Skeleton } from '@/components/Skeleton';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import { formatMoney } from '@/lib/money';
import { payoffMonth } from '@/lib/loanPayoff';
import type { LoanTotals } from './loanTotals';

function Chip({ bold, rest, lent }: { bold: string; rest: string; lent?: boolean }) {
  return (
    <View style={[styles.chip, lent && styles.chipLent]}>
      <Text style={styles.chipText} numberOfLines={1}>
        <Text style={styles.chipBold}>{bold}</Text> {rest}
      </Text>
    </View>
  );
}

/**
 * The first block on Loans: what you owe, when you'll be free of it, and the
 * numbers the cards don't add up for you (EMIs a month, interest still to
 * pay, how many loans). Money lent is a mint chip, only when there is some.
 */
export function LoansHero({ totals, loading }: { totals: LoanTotals; loading?: boolean }) {
  if (loading) {
    return (
      <View style={[styles.card, styles.skeleton]}>
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

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[shade(hue, 93), shade(hue, 85)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.circle} />
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
          {owes && (
            <View style={styles.track}>
              <GrowFill animKey="loans:hero" pct={totals.repaidFraction * 100} style={styles.fill} />
            </View>
          )}
          <View style={styles.chips}>
            {owes && <Chip bold={formatMoney(totals.emiPerMonthMinor)} rest="EMIs a month" />}
            {owes && totals.interestLeftMinor > 0 && (
              <Chip bold={formatMoney(totals.interestLeftMinor)} rest="interest still to pay" />
            )}
            <Chip
              bold={String(totals.activeCount)}
              rest={totals.activeCount === 1 ? 'active loan' : 'active loans'}
            />
            {owes && totals.owedToYouMinor > 0 && (
              <Chip lent bold={formatMoney(totals.owedToYouMinor)} rest="owed to you" />
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
    marginBottom: 14,
    padding: 16,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  skeleton: {
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
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 30, color: theme.colors.textPrimary, marginTop: 4 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  chipLent: { backgroundColor: theme.colors.secondary + '66' },
  chipText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  chipBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});
