import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

/**
 * A quiet estimate beside the calculation disclosure, separate from the user's daily spending goal.
 * Current month only; the accessible description retains the number of remaining days.
 */
export function AllowanceTile({ perDayMinor, daysLeft }: { perDayMinor: number; daysLeft: number }) {
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={`${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left, about ${formatMoney(perDayMinor)} a day`}
    >
      <Text style={styles.text}>
        ≈ <Text style={styles.amount}>{formatMoney(perDayMinor)}</Text> a day
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    flexShrink: 1,
  },
  text: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
