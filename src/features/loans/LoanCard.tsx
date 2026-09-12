import { View, Text, Pressable, Animated } from 'react-native';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { payoffFraction } from '@/lib/loan';
import { roundedMinor } from '@/lib/round';
import { Loan } from '@/types';
import { usePressScale } from '@/lib/usePressScale';
import { NeoTile } from '@/components/NeoTile';
import { styles } from './loans.styles';

/**
 * One loan in the list — payoff-first: a thin progress bar (share of
 * principal actually repaid) is the dominant visual, replacing the earlier
 * coloured direction-rail and circular status-dot pill. Direction still
 * reads through the bar's own colour (coral for borrowed, mint for lent),
 * just spent on one precise line instead of a whole card edge — see the
 * signed-off design and payoffFraction's own comment for why this is a
 * principal-based percentage, not an installment count.
 */
export function LoanCard({
  loan,
  fadeStyle,
  onPress,
  muted,
}: {
  loan: Loan;
  fadeStyle: any;
  onPress: () => void;
  muted?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const isClosed = loan.status === 'closed';
  const fraction = isClosed ? 1 : payoffFraction(loan.principalMinor, loan.outstandingPrincipalMinor);
  const fillColor = isClosed
    ? styles.payoffFillClosed
    : loan.direction === 'borrowed'
      ? styles.payoffFillBorrowed
      : styles.payoffFillLent;

  return (
    <Animated.View style={fadeStyle}>
      <NeoTile style={[styles.card, muted && styles.cardMuted]}>
        <Animated.View style={animatedStyle}>
          <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName} numberOfLines={1}>
                {loan.counterparty}
              </Text>
              <View style={styles.loanFigs}>
                <Text style={styles.loanOutstanding} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(roundedMinor(loan.outstandingPrincipalMinor))}
                </Text>
                <Text style={styles.loanEmi}>
                  {isClosed ? 'Closed' : `${formatMoney(loan.emiAmountMinor)}/mo`}
                </Text>
              </View>
            </View>
            <Text style={styles.cardSub}>
              {(loan.interestRateAnnualBp / 100).toFixed(2)}% ·{' '}
              {loan.rateType === 'floating' ? 'Floating' : 'Fixed'} ·{' '}
              {loan.direction === 'borrowed' ? 'Borrowed' : 'Lent'}
            </Text>

            <View style={styles.payoffTrack}>
              <View style={[styles.payoffFill, fillColor, { width: `${fraction * 100}%` }]} />
            </View>
            <View style={styles.payoffCaption}>
              <Text style={styles.payoffCaptionText}>
                <Text style={styles.payoffCaptionBold}>{formatPctChange(fraction * 100)}</Text> of principal
                repaid
              </Text>
              <Text style={styles.payoffCaptionText}>
                {isClosed ? 'Done' : loan.nextDueDate ? `Next due ${loan.nextDueDate}` : ' '}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </NeoTile>
    </Animated.View>
  );
}
