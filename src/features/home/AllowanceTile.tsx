import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { summaryInk } from '@/components/SummaryGradient';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { themedStyles } from '@/theme/themedStyles';

/**
 * What can be spent a day from here on, under the main figure. It is an estimate,
 * separate from the user's daily spending goal. Current month only.
 */
export function AllowanceTile({ perDayMinor, daysLeft }: { perDayMinor: number; daysLeft: number }) {
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={`${days} left, about ${formatMoney(perDayMinor)} a day`}
    >
      <Text style={styles.text}>
        About <Text style={styles.amount}>{formatMoney(perDayMinor)} a day</Text> for {days}
      </Text>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    tile: {
      alignSelf: 'flex-start',
      flexShrink: 1,
      paddingBottom: 2,
    },
    text: {
      flexShrink: 1,
      fontFamily: theme.font.body,
      fontSize: 12,
      color: summaryInk.secondary,
    },
    amount: {
      fontFamily: theme.font.bodyBold,
      fontSize: 12,
      color: summaryInk.text,
      fontVariant: ['tabular-nums'],
    },
  })
);
