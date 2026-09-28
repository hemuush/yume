import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { Account } from '@/types';
import { Amount } from '@/components/Amount';
import type { McIconName } from '@/components/iconName';
import { accountIcon } from '@/lib/account';
import { shade } from '@/lib/color';
import { usePressScale } from '@/lib/usePressScale';

/** The strip snaps one card at a time: card width plus the strip's gap. */
export const ACCOUNT_CHIP_WIDTH = 150;
export const ACCOUNT_STRIP_GAP = 12;

/**
 * One account in the horizontal "Your accounts" strip (the Home A sign-off):
 * a soft card tinted by what kind of account it is — everyday money in the
 * theme's own colour, cash in sage, a wallet in teal, a card in gold,
 * savings in peach — so colour says something about the account rather than
 * its place in the list. Tapping opens the account's summary sheet (see
 * AccountSummarySheet).
 */
export function AccountChip({ account, onPress }: { account: Account; onPress: () => void }) {
  const { accent } = useAccent();
  const base = accountHue(account.type, accent);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${account.name}, ${account.type.replace('_', ' ')}. Open summary`}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <LinearGradient
          colors={[shade(base, 94), shade(base, 88)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        />
        {/* Two soft circles in the corner, the same quiet shape language as Needs you and the month ring. */}
        <View style={styles.circleBig} />
        <View style={styles.circleSmall} />
        <View style={styles.icon}>
          <MaterialCommunityIcons
            name={accountIcon(account.type) as McIconName}
            size={16}
            color={shade(base, 38, 10)}
          />
        </View>
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
      </Animated.View>
    </Pressable>
  );
}

/** The colour family a card is tinted in, by account type — its summary sheet's card too. */
export function accountHue(type: Account['type'], accent: string): string {
  switch (type) {
    case 'cash':
      return theme.colors.flatLime;
    case 'wallet':
      return theme.colors.secondary;
    case 'credit_card':
      return theme.colors.idGoldDeep;
    case 'savings':
      return theme.colors.idCoralDeep;
    default:
      return accent;
  }
}

const styles = StyleSheet.create({
  card: {
    width: ACCOUNT_CHIP_WIDTH,
    borderRadius: theme.radius.xl2,
    padding: 14,
    overflow: 'hidden',
    shadowColor: theme.colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  circleBig: {
    position: 'absolute',
    right: -28,
    bottom: -32,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  circleSmall: {
    position: 'absolute',
    right: 24,
    bottom: 34,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  name: {
    fontFamily: theme.font.roundedBold,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    marginTop: 10,
  },
  balance: { fontFamily: theme.font.monoBold, fontSize: 16, color: theme.colors.textPrimary, marginTop: 4 },
  type: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textTransform: 'capitalize',
  },
});
