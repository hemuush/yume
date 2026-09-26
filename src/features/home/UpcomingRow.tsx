import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import { homeStyles as h, HOME } from './homeStyles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One row in the "Upcoming" list — a loan EMI or a recurring rule's next
 * occurrence, both rendered the same way so the list reads as one thing
 * (what's coming up) rather than "the loan, then a separate different-
 * looking thing for bills". Meant to sit inside one shared card with
 * dividers between rows, the same pattern Recent activity already uses.
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
  /** Due today or already overdue — swaps the icon badge and subtitle to the coral "worth a look" tone instead of the neutral default. */
  urgent?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={[styles.row, divider && styles.divider, animatedStyle]}
    >
      <View style={[styles.iconWrap, { backgroundColor: urgent ? theme.colors.expenseTint : iconBg }]}>
        <Feather name={icon} size={HOME.iconGlyph} color={urgent ? theme.colors.expense : iconColor} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.sub, urgent && styles.subUrgent]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.amount, sign === '+' && styles.income, sign === '-' && styles.expense]}>
        {sign}
        {formatMoney(amountMinor)}
      </Text>
      <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
    </AnimatedPressable>
  );
}

/**
 * The row that stands in for whatever's past `useCappedList`'s cap — same
 * shape as a real `UpcomingRow` (icon left, label filling the middle) so it
 * reads as one more row in the list rather than a different kind of thing,
 * the same "+N more" language `DayCard` uses for a busy day.
 */
export function UpcomingMoreRow({
  count,
  divider,
  onPress,
}: {
  count: number;
  divider?: boolean;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${count} more upcoming`}
      style={[styles.row, divider && styles.divider, animatedStyle]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Feather name="more-horizontal" size={HOME.iconGlyph} color={theme.colors.textMuted} />
      </View>
      <Text style={styles.moreText}>+{count} more</Text>
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
  amount: h.amount,
  income: h.income,
  expense: h.expense,
  moreText: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
});
