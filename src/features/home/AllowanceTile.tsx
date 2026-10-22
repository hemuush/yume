import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ProgressRing } from '@/components/ProgressRing';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';

/**
 * What can be spent a day for the rest of the month and still end it free: a ring for the days left (of the
 * month) and the amount. Current month only; shown when something is free.
 */
export function AllowanceTile({
  perDayMinor,
  daysLeft,
  daysInMonth,
}: {
  perDayMinor: number;
  daysLeft: number;
  daysInMonth: number;
}) {
  const { accent } = useAccent();
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={`${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left, about ${formatMoney(perDayMinor)} a day`}
    >
      <ProgressRing
        percent={(daysLeft / daysInMonth) * 100}
        color={themeInk(accent)}
        animKey="home-allowance"
        size={30}
        stroke={4}
      />
      <View style={styles.text}>
        <Text style={styles.days} numberOfLines={1}>
          {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
        </Text>
        <Text style={styles.amount} numberOfLines={1}>
          {formatMoney(perDayMinor)} a day
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.tray,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    flexShrink: 1,
  },
  text: { flexShrink: 1 },
  days: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
