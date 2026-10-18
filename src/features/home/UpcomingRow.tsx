import { View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { DateTile } from '@/components/DateTile';
import { toLocalIsoDate } from '@/lib/date';
import { SCREEN } from '@/components/screenStyles';
import { HomeRow } from './HomeRow';

/**
 * One Upcoming row (loan EMI or recurring rule's next occurrence), the same row as Budgets and Goals: the due
 * date as a tile, the title and when, the amount on the right with a status chip when it is late or close.
 * Sits inside the one shared card with dividers between rows.
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
  dueDate = date,
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
  /** Due today or already overdue: the coral "worth a look" tone. */
  urgent?: boolean;
  /** Due within the next few days but not yet today: the amber tone between neutral and urgent. */
  soon?: boolean;
  /** The due date (YYYY-MM-DD): shown as a date tile ("01 OCT") in place of the icon, as Plan does. */
  date?: string;
  /** The due date for the Overdue / Due now chip when the row shows an icon instead of the date tile. */
  dueDate?: string;
  /** A bill to pay: a "Pay" pill ends the row; tapping anywhere on the row still opens it. */
  actionLabel?: string;
  /** Due soon (pinned): the row sits on a pale amber panel so it stands out from the rest of the week. */
  highlight?: boolean;
}) {
  const money = `${sign}${formatMoney(amountMinor)}`;
  const chip = urgent
    ? {
        label: dueDate && dueDate < toLocalIsoDate(new Date()) ? 'Overdue' : 'Due now',
        tone: 'warning' as const,
      }
    : soon
      ? { label: 'Due soon', tone: 'due' as const }
      : undefined;
  return (
    <HomeRow
      leading={
        date ? (
          <DateTile iso={date} background={iconBg} urgent={urgent} soon={soon} />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: urgent ? theme.colors.expenseTint : iconBg }]}>
            <Feather name={icon} size={SCREEN.iconGlyph} color={urgent ? theme.colors.expense : iconColor} />
          </View>
        )
      }
      title={title}
      subtitle={subtitle}
      subtitleTone={urgent ? 'urgent' : soon ? 'soon' : undefined}
      value={money}
      valueTone={sign === '+' ? 'income' : undefined}
      chip={chip}
      action={actionLabel}
      onPress={onPress}
      divider={divider}
      highlight={highlight}
      accessibilityLabel={`${title}, ${subtitle}, ${money}${actionLabel ? `, ${actionLabel}` : ''}`}
    />
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
