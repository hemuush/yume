import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import { DateTile } from '@/components/DateTile';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One Upcoming row (loan EMI or recurring rule's next occurrence), rendered alike so the list reads as one
 * thing. Sits inside one shared card with dividers between rows, like Recent activity.
 */
export function UpcomingRow({
  icon,
  iconBg,
  iconColor = theme.colors.ink,
  title,
  subtitle,
  amountMinor,
  sign = '',
  onPress,
  divider,
  urgent,
  soon,
  date,
  actionLabel,
  highlight,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  iconBg: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  amountMinor: number;
  sign?: '+' | '-' | '';
  onPress: () => void;
  divider?: boolean;
  /**
   * Due today or already overdue — swaps the icon badge and subtitle to the coral "worth a look" tone
   * instead of the neutral default.
   */
  urgent?: boolean;
  /** Due within the next few days but not yet today — the amber tone between neutral and urgent. */
  soon?: boolean;
  /** The due date (YYYY-MM-DD): shown as a date tile ("01 OCT") in place of the icon, as Plan does. */
  date?: string;
  /** A bill to pay: a "Pay" pill stands where the chevron would; tapping anywhere on the row still opens it. */
  actionLabel?: string;
  /** Due soon (pinned): the row sits on a pale amber panel so it stands out from the rest of the week. */
  highlight?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={[styles.row, divider && styles.divider, highlight && styles.highlight, animatedStyle]}
    >
      {date ? (
        <DateTile iso={date} background={iconBg} urgent={urgent} soon={soon} />
      ) : (
        <View style={[styles.iconWrap, { backgroundColor: urgent ? theme.colors.expenseTint : iconBg }]}>
          <Feather name={icon} size={SCREEN.iconGlyph} color={urgent ? theme.colors.expense : iconColor} />
        </View>
      )}
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.sub, urgent ? styles.subUrgent : soon && styles.subSoon]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {/* A bill reads in ink; only money coming in is coloured (green). */}
      <Text style={[styles.amount, sign === '+' && styles.income]}>
        {sign}
        {formatMoney(amountMinor)}
      </Text>
      {actionLabel ? (
        <View style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </View>
      ) : (
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: h.row,
  divider: h.divider,
  iconWrap: h.iconTile,
  mid: h.mid,
  title: h.title,
  sub: h.sub,
  subUrgent: h.subUrgent,
  subSoon: h.subSoon,
  amount: h.amount,
  income: h.income,
  highlight: {
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderTopWidth: 0,
    backgroundColor: theme.colors.dueRow,
  },
  action: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  actionText: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.white },
  moreText: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textSecondary },
});
