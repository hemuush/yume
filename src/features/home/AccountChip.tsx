import { StyleSheet, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { Account } from '@/types';
import { Amount } from '@/components/Amount';
import { FlatIconBadge } from '@/components/FlatIconBadge';
import { accountBadgeColor, accountIcon } from '@/lib/account';
import { usePressScale } from '@/lib/usePressScale';
import { SoftCard } from './SoftCard';

/** The strip snaps one card at a time: card width plus the strip's gap. */
export const ACCOUNT_CHIP_WIDTH = 150;
export const ACCOUNT_STRIP_GAP = 12;

/**
 * One account in the horizontal "Your accounts" strip. Previously cycled
 * through a fixed rainbow (ID_PALETTE) by list position — a colour an
 * account happened to land on said nothing about the account itself, and
 * added a fourth/fifth hue to a screen that already had too many competing
 * pastels. The card is now a plain neutral surface; the one badge colour
 * that survives is picked by account *type* (the user's own accent for
 * everyday money, a warmer tone for savings/credit) so colour means
 * something again instead of just marking a position in a list.
 *
 * Tapping opens the account's summary sheet (see AccountSummarySheet).
 */
export function AccountChip({ account, onPress }: { account: Account; onPress: () => void }) {
  const { accent } = useAccent();
  const badgeColor = accountBadgeColor(account.type, accent);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${account.name}, ${account.type.replace('_', ' ')}. Open summary`}
    >
      <Animated.View style={animatedStyle}>
        <SoftCard style={styles.card}>
          <FlatIconBadge name={accountIcon(account.type)} backgroundColor={badgeColor} />
          <Text style={styles.name} numberOfLines={1}>
            {account.name}
          </Text>
          <Amount
            minor={account.currentBalanceMinor}
            currency={account.currency}
            sensitive={account.type === 'savings'}
            style={styles.balance}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          <Text style={styles.type}>{account.type.replace('_', ' ')}</Text>
        </SoftCard>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: ACCOUNT_CHIP_WIDTH },
  name: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary, marginTop: 10 },
  balance: { fontFamily: theme.font.monoBold, fontSize: 15, color: theme.colors.textPrimary, marginTop: 8 },
  type: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 6,
    textTransform: 'capitalize',
  },
});
