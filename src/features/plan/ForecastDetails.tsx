import { StyleSheet, View } from 'react-native';
import { ModalSheet } from '@/components/ModalSheet';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth } from '@/lib/dateLabels';
import { Runway } from './runway';

/** Read-only explanation of the same loaded runway, never a second calculation. */
export function ForecastDetails({ runway, onClose }: { runway: Runway; onClose: () => void }) {
  const end = runway.days.at(-1)?.date;
  const facts: [string, string][] = [
    ['Available today', formatMoney(runway.startMinor)],
    ['Going out', formatMoney(runway.days.reduce((total, day) => total + day.outMinor, 0))],
    ['Coming in', formatMoney(runway.inMinor)],
  ];
  if (runway.short)
    facts.push([`First shortfall · ${dayMonth(runway.short.date)}`, formatMoney(runway.short.minor)]);
  facts.push(
    [`Lowest · ${dayMonth(runway.lowDate)}`, formatMoney(runway.lowMinor)],
    [end ? `Ends ${dayMonth(end)}` : 'Ending balance', formatMoney(runway.endMinor)]
  );
  return (
    <ModalSheet visible title="Forecast calculation" onClose={onClose}>
      <Text style={styles.note}>
        Active bank, cash and wallet accounts in your default currency. Savings, investments and credit limits
        are excluded from the starting balance.
      </Text>
      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        Scheduled payments and income only. Everyday spending and unreceived refunds are excluded. Transfers
        between spending accounts are excluded; moving money across the savings boundary affects cash flow.
        Card purchases wait for their bill.
      </Text>
      <Text style={styles.note}>
        The first shortfall is the amount missing on that date, not the amount needed for the entire period.
        The lowest and ending balances may be different.
      </Text>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  note: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginBottom: 14,
  },
  facts: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 22,
    padding: 14,
    gap: 14,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  label: {
    flexGrow: 1,
    flexBasis: 140,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  value: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
