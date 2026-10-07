import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

/**
 * The one line that nets what you're owed against what you owe, as a white pill in the sky header; the group
 * headings below carry the two totals.
 */
export function PeopleNet({ netMinor }: { netMinor: number }) {
  return (
    <View style={styles.net}>
      <Text style={styles.netLabel}>
        {netMinor > 0 ? 'Net, in your favour' : netMinor < 0 ? 'Net, against you' : 'Net, even'}
      </Text>
      <Text
        style={[
          styles.netValue,
          netMinor > 0 && { color: theme.colors.incomeText },
          netMinor < 0 && { color: theme.colors.expenseText },
        ]}
      >
        {netMinor > 0 ? '+' : netMinor < 0 ? '−' : ''}
        {formatMoney(Math.abs(netMinor))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  net: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: `${theme.colors.surface}D9`,
  },
  netLabel: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary },
  netValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textMuted },
});
