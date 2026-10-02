import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { parseLocalIsoDate } from '@/lib/date';

/**
 * A date as a small tile — "01" over "OCT" — the one used wherever a row is
 * about a day rather than a category: Home's Upcoming, Plan's Coming up, and
 * the recurring sheet's next dates. `urgent` turns it red for something overdue
 * or due today; `soon` turns it amber for something due in the next few days.
 */
export function DateTile({
  iso,
  background = theme.colors.surfaceAlt,
  urgent = false,
  soon = false,
}: {
  iso: string;
  background?: string;
  urgent?: boolean;
  soon?: boolean;
}) {
  const d = parseLocalIsoDate(iso);
  const warn = !urgent && soon;
  const fill = urgent ? theme.colors.expenseTint : warn ? theme.colors.idGold : background;
  return (
    <View style={[styles.tile, { backgroundColor: fill }]}>
      <Text style={[styles.day, urgent && styles.urgent, warn && styles.soon]}>
        {String(d.getDate()).padStart(2, '0')}
      </Text>
      <Text style={[styles.month, urgent && styles.urgent, warn && styles.soon]}>
        {d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: 42, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  day: { fontFamily: theme.font.roundedBold, fontSize: 15, lineHeight: 17, color: theme.colors.textPrimary },
  month: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  urgent: { color: theme.colors.expenseText },
  soon: { color: theme.colors.warnInk },
});
