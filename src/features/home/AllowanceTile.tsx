import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

/**
 * What can be spent a day from here on, as a soft theme-tinted pill under the main figure. It is an estimate,
 * separate from the user's daily spending goal. Current month only.
 */
export function AllowanceTile({ perDayMinor, daysLeft }: { perDayMinor: number; daysLeft: number }) {
  const { accent } = useAccent();
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
  return (
    <View
      style={[styles.tile, { backgroundColor: shade(accent, 93) }]}
      accessible
      accessibilityLabel={`${days} left, about ${formatMoney(perDayMinor)} a day`}
    >
      <Text style={styles.text}>
        About <Text style={styles.amount}>{formatMoney(perDayMinor)} a day</Text> for {days}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    borderRadius: theme.radius.pill,
  },
  text: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
