import { View, Pressable, Animated, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { payoffFraction } from '@/lib/loan';
import { roundedMinor } from '@/lib/round';
import { Loan } from '@/types';
import { usePressScale } from '@/lib/usePressScale';
import { GrowFill } from '@/components/GrowFill';
import { CountUpAmount } from '@/components/CountUpAmount';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { payoffMonthShort } from '@/lib/loanPayoff';
import type { LoanProgress } from '@/db/loans';
import { loanBarTone, loanGlyph, loanIcon, loanTint } from './loanIdentity';

/**
 * One loan in the list: flat card with its pale tile, progress and debt-free month; open loans end with the
 * next EMI and a Pay pill to its pay sheet. A closed loan is the same card in grey, "Paid off", no footer.
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
  /** Opens this loan's pay sheet for its next EMI. */
  onPay: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const isClosed = loan.status === 'closed';
  const isBorrowed = loan.direction === 'borrowed';
  const fraction = isClosed ? 1 : payoffFraction(loan.principalMinor, loan.outstandingPrincipalMinor);
  const lastDueDate = progress?.lastDueDate;
  const nextDueDate = progress?.nextDueDate ?? loan.nextDueDate;
  const nextEmiMinor = progress?.nextEmiMinor ?? loan.emiAmountMinor;
  const repaidLine = progress ? `${progress.paidCount} of ${progress.totalCount} EMIs` : null;

  return (
    <Animated.View style={fadeStyle}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          style={styles.card}
        >
          <View style={styles.head}>
            <View
              style={[styles.icon, { backgroundColor: isClosed ? theme.colors.surfaceAlt : loanTint(hue) }]}
            >
              <MaterialCommunityIcons
                name={loanIcon(loan) as McIconName}
                size={18}
                color={isClosed ? theme.colors.textMuted : loanGlyph(hue)}
              />
            </View>
            <View style={styles.headText}>
              <Text style={styles.name} numberOfLines={2}>
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

          <View style={styles.track}>
            <GrowFill
              animKey={`loan:${loan.id}`}
              pct={fraction * 100}
              style={[styles.fill, { backgroundColor: isClosed ? theme.colors.textMuted : loanBarTone(hue) }]}
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
                <Text style={styles.nextLabel}>Next EMI</Text>
                <Text style={styles.nextLine} numberOfLines={1}>
                  {weekdayDayMonth(nextDueDate)} ·{' '}
                  <Text style={styles.nextAmount}>{formatMoney(nextEmiMinor)}</Text>
                </Text>
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
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 38 * 0.32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, minWidth: 0 },
  name: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  figs: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '42%' },
  outstanding: { fontFamily: theme.font.monoBold, fontSize: 15, color: theme.colors.textPrimary },
  left: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  paidOff: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.incomeText },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.divider,
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, minWidth: 5 },
  caption: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  captionText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, flexShrink: 1 },
  captionBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  // The next payment in a soft amber box, so what's due next stands out from the loan's figures.
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dueRow,
  },
  footerText: { flex: 1, minWidth: 0 },
  nextLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.dueInk },
  nextLine: {
    fontFamily: theme.font.bodyBold,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  nextAmount: { fontFamily: theme.font.monoBold },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  pillPressed: { opacity: 0.8 },
  pillText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.white },
});
