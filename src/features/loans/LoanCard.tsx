import { View, Text, Pressable, Animated } from 'react-native';
import { formatMoney } from '@/lib/money';
import { Loan } from '@/types';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { NeoTile } from '@/components/NeoTile';
import { styles } from './loans.styles';

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
  const statusPillStyle =
    loan.status === 'active'
      ? styles.statusPillActive
      : loan.status === 'defaulted'
        ? styles.statusPillDefaulted
        : styles.statusPillClosed;
  const statusDotStyle =
    loan.status === 'active'
      ? styles.statusDotActive
      : loan.status === 'defaulted'
        ? styles.statusDotDefaulted
        : styles.statusDotClosed;
  return (
    <Animated.View style={fadeStyle}>
      {/* Colored by direction — borrowed = coral, lent = teal, the same
          pairing as the You-owe/Owed-to-you summary above — so the color
          means the same thing whether you're scanning the list or reading
          one card. Closed loans keep the color but fade, same "still here,
          not where the action is" idea as everywhere else. */}
      <NeoTile
        style={[styles.card, muted && styles.cardMuted]}
        backgroundColor={loan.direction === 'borrowed' ? theme.colors.idCoral : theme.colors.idTeal}
      >
        <Animated.View style={animatedStyle}>
          <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName} numberOfLines={1}>
                {loan.counterparty}
              </Text>
              <View
                style={[
                  styles.badge,
                  loan.direction === 'borrowed' ? styles.badgeExpense : styles.badgeIncome,
                ]}
              >
                <Text style={styles.badgeText}>{loan.direction === 'borrowed' ? 'Borrowed' : 'Lent'}</Text>
              </View>
            </View>
            <Text style={styles.cardSub}>
              {(loan.interestRateAnnualBp / 100).toFixed(2)}% p.a. · {loan.tenureMonths} months
              {loan.nextDueDate ? ` · Next due ${loan.nextDueDate}` : ''}
            </Text>
            <View style={styles.cardStatsRow}>
              <View>
                <Text style={styles.statLabel}>Outstanding</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(loan.outstandingPrincipalMinor)}
                </Text>
              </View>
              <View>
                <Text style={styles.statLabel}>EMI</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(loan.emiAmountMinor)}
                </Text>
              </View>
              <View>
                <Text style={styles.statLabel}>Status</Text>
                <View style={[styles.statusPill, statusPillStyle]}>
                  <View style={[styles.statusDot, statusDotStyle]} />
                  <Text style={styles.statusPillText}>{loan.status}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </NeoTile>
    </Animated.View>
  );
}
