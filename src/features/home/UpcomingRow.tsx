import { View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { DateTile } from '@/components/DateTile';
import { toLocalIsoDate } from '@/lib/date';
import { SCREEN } from '@/components/screenStyles';
import { Text } from '@/components/Text';
import { PlanMoneyRow, planRowText } from '@/features/plan/PlanMoneyRow';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { themedStyles } from '@/theme/themedStyles';

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
  payInline = false,
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
  /** Home's list: a payable bill says its amount beside the due date, leaving Pay as the row's ending. */
  payInline?: boolean;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const inline = payInline && !!actionLabel;
  const money = `${sign}${formatMoney(amountMinor)}`;
  const chip = urgent
    ? dueDate && dueDate < toLocalIsoDate(new Date())
      ? 'Overdue'
      : 'Due now'
    : soon
      ? 'Due soon'
      : undefined;
  const tone = urgent ? planRowText.bad : soon ? planRowText.warn : null;
  // A bill with a Pay button says its amount beside the due date, so the button is the row's only ending.
  const line = inline ? [subtitle, money].filter(Boolean).join(' · ') : subtitle;
  return (
    <PlanMoneyRow
      icon={
        date ? (
          <DateTile iso={date} background={iconBg} urgent={urgent} soon={soon} />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: urgent ? theme.colors.expenseTint : iconBg }]}>
            <Feather name={icon} size={SCREEN.iconGlyph} color={urgent ? theme.colors.expense : iconColor} />
          </View>
        )
      }
      title={title}
      subtitle={line ? <Text style={[planRowText.subtitle, tone]}>{line}</Text> : undefined}
      value={
        inline ? null : <Text style={[planRowText.value, sign === '+' && planRowText.good]}>{money}</Text>
      }
      // Overdue and Due now stay as a note beside Pay; the amber panel already says "due soon".
      note={chip && !(inline && !urgent) ? <Text style={[planRowText.note, tone]}>{chip}</Text> : undefined}
      trailing={
        actionLabel ? (
          <View style={[styles.action, { backgroundColor: ink }]}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </View>
        ) : undefined
      }
      onPress={onPress}
      divider={divider}
      highlight={highlight}
      accessibilityLabel={`${title}, ${subtitle}, ${money}${actionLabel ? `, ${actionLabel}` : ''}`}
    />
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    action: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: theme.radius.pill,
    },
    actionText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.onInk },
    iconWrap: {
      width: SCREEN.mark,
      height: SCREEN.mark,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
