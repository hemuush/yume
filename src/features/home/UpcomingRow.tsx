import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

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
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={[styles.row, divider && styles.divider]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={14} color={iconColor} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.amount, sign === '+' && styles.income, sign === '-' && styles.expense]}>
        {sign}
        {formatMoney(amountMinor)}
      </Text>
      <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13.5, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 1 },
  amount: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  income: { color: theme.colors.income },
  expense: { color: theme.colors.expense },
});
