import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { payoffFraction } from '@/lib/loan';
import { roundedMinor } from '@/lib/round';
import { shade } from '@/lib/color';
import { Loan } from '@/types';
import { usePressScale } from '@/lib/usePressScale';
import { GrowFill } from '@/components/GrowFill';
import { CountUpAmount } from '@/components/CountUpAmount';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { payoffMonthShort } from '@/lib/loanPayoff';
import { weekdayDayMonth } from '@/lib/dateLabels';
import type { LoanProgress } from '@/db/loans';
import { loanIcon } from './loanIdentity';

/**
 * One loan in the list: an identity-coloured card (the same soft gradient as
 * Home's account cards) with how far along it is, and, while it is open, the
 * next EMI with a Pay pill that goes straight to that EMI's pay sheet. A
 * closed loan is a plain card that says "Paid off".
 */
export function LoanCard({
  loan,
  hue,
  progress,
  fadeStyle,
  onPress,
  onPay,
}: {
  loan: Loan;
  /** The loan's identity colour (loanHues). */
  hue: string;
  /** This loan's row from getLoanProgress: EMIs paid, next EMI, last EMI. */
  progress?: LoanProgress;
  fadeStyle: React.ComponentProps<typeof Animated.View>['style'];
  onPress: () => void;
  onPay: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const isClosed = loan.status === 'closed';
  const isBorrowed = loan.direction === 'borrowed';
  const fraction = isClosed ? 1 : payoffFraction(loan.principalMinor, loan.outstandingPrincipalMinor);
  const nextDueDate = progress?.nextDueDate ?? loan.nextDueDate;
  const nextEmiMinor = progress?.nextEmiMinor ?? loan.emiAmountMinor;
  const lastDueDate = progress?.lastDueDate;
  const repaidLine = progress ? `${progress.paidCount} of ${progress.totalCount} EMIs` : null;

  return (
    <Animated.View style={fadeStyle}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          style={[styles.card, isClosed && styles.cardClosed]}
        >
          {!isClosed && (
            <>
              <LinearGradient
                colors={[shade(hue, 93), shade(hue, 85)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.circle} />
            </>
          )}
          <View style={styles.head}>
            <View style={[styles.icon, isClosed && styles.iconClosed]}>
              <MaterialCommunityIcons
                name={loanIcon(loan) as McIconName}
                size={18}
                color={isClosed ? theme.colors.textMuted : shade(hue, 30, 10)}
              />
            </View>
            <View style={styles.headText}>
              <Text style={styles.name} numberOfLines={1}>
                {loan.counterparty}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {(loan.interestRateAnnualBp / 100).toFixed(2)}% ·{' '}
                {loan.rateType === 'floating' ? 'Floating' : 'Fixed'}
                {isBorrowed ? '' : ' · Lent'}
              </Text>
            </View>
            <View style={styles.figs}>
              {isClosed ? (
                <Text style={styles.paidOff}>Paid off</Text>
              ) : (
                <>
                  <CountUpAmount
                    minor={roundedMinor(loan.outstandingPrincipalMinor)}
                    countFromZero={false}
                    style={styles.outstanding}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                  <Text style={styles.left}>{isBorrowed ? 'left' : 'to receive'}</Text>
                </>
              )}
            </View>
          </View>

          <View style={[styles.track, isClosed && styles.trackClosed]}>
            <GrowFill
              animKey={`loan:${loan.id}`}
              pct={fraction * 100}
              style={[styles.fill, isClosed && styles.fillClosed]}
            />
          </View>
          <View style={styles.caption}>
            <Text style={styles.captionText} numberOfLines={1}>
              <Text style={styles.captionBold}>{formatRatioPct(fraction)}</Text> repaid
              {repaidLine ? ` · ${repaidLine}` : ''}
            </Text>
            {!isClosed && lastDueDate ? (
              <Text style={styles.captionText} numberOfLines={1}>
                {isBorrowed ? 'Debt-free' : 'Repaid'} {payoffMonthShort(lastDueDate)}
              </Text>
            ) : null}
          </View>

          {!isClosed && nextDueDate && (
            <View style={styles.footer}>
              <View style={styles.footerText}>
                <Text style={styles.next} numberOfLines={1}>
                  Next EMI · {weekdayDayMonth(nextDueDate)}
                </Text>
                <Text style={styles.nextAmount}>{formatMoney(nextEmiMinor)}</Text>
              </View>
              <Pressable
                onPress={onPay}
                accessibilityRole="button"
                accessibilityLabel={`${isBorrowed ? 'Pay' : 'Mark received'} next EMI for ${loan.counterparty}`}
                hitSlop={8}
                style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
              >
                <Text style={styles.pillText}>{isBorrowed ? 'Pay' : 'Received'}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  cardClosed: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  circle: {
    position: 'absolute',
    right: -34,
    bottom: -48,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconClosed: { backgroundColor: theme.colors.surfaceAlt },
  headText: { flex: 1, minWidth: 0 },
  name: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  figs: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  outstanding: { fontFamily: theme.font.monoBold, fontSize: 16, color: theme.colors.textPrimary },
  left: { fontFamily: theme.font.body, fontSize: 10.5, color: theme.colors.textSecondary, marginTop: 1 },
  paidOff: { fontFamily: theme.font.roundedBold, fontSize: 14, color: theme.colors.incomeText },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginTop: 14,
    overflow: 'hidden',
  },
  trackClosed: { backgroundColor: theme.colors.surfaceAlt },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.ink },
  fillClosed: { backgroundColor: theme.colors.textMuted },
  caption: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  captionText: {
    fontFamily: theme.font.mono,
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  captionBold: { fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(18,19,15,0.1)',
  },
  footerText: { flex: 1, minWidth: 0 },
  next: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  nextAmount: {
    fontFamily: theme.font.monoBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginTop: 1,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  pillPressed: { opacity: 0.8 },
  pillText: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.surface },
});
