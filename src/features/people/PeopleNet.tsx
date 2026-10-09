import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { Kicker, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

/**
 * Friends & Family's first card: the net of what you're owed against what you owe, then a bar split between
 * the two sides with each total and how many people are on it.
 */
export function PeopleNet({
  netMinor,
  owedToYouMinor,
  youOweMinor,
  owedCount,
  oweCount,
}: {
  netMinor: number;
  owedToYouMinor: number;
  youOweMinor: number;
  owedCount: number;
  oweCount: number;
}) {
  const color =
    netMinor > 0
      ? theme.colors.incomeText
      : netMinor < 0
        ? theme.colors.expenseText
        : theme.colors.textPrimary;
  const total = owedToYouMinor + youOweMinor;
  return (
    <Glass radius={28} tone="strong" style={[frost.hero, styles.card]}>
      <Kicker icon="users">
        {netMinor > 0 ? 'Net, in your favour' : netMinor < 0 ? 'Net, against you' : 'Net, even'}
      </Kicker>
      <Text style={[frost.bigValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {netMinor > 0 ? '+' : netMinor < 0 ? '−' : ''}
        {formatMoney(Math.abs(netMinor))}
      </Text>
      {total > 0 && (
        <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {owedToYouMinor > 0 && <View style={[styles.side, styles.owed, { flex: owedToYouMinor }]} />}
          {youOweMinor > 0 && <View style={[styles.side, styles.owe, { flex: youOweMinor }]} />}
        </View>
      )}
      <View style={styles.legend}>
        <Text style={styles.legendText} numberOfLines={1}>
          <Text style={[styles.legendBold, { color: theme.colors.incomeText }]}>
            +{formatMoney(owedToYouMinor)}
          </Text>{' '}
          owed to you · {owedCount}
        </Text>
        <Text style={styles.legendText} numberOfLines={1}>
          you owe{' '}
          <Text style={[styles.legendBold, { color: theme.colors.expenseText }]}>
            {formatMoney(youOweMinor)}
          </Text>{' '}
          · {oweCount}
        </Text>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 0, marginBottom: 6 },
  bar: { flexDirection: 'row', height: 12, gap: 2, borderRadius: 6, overflow: 'hidden' },
  side: { height: '100%' },
  owed: { backgroundColor: theme.colors.slice.saved },
  owe: { backgroundColor: theme.colors.slice.spent },
  legend: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  legendText: {
    flexShrink: 1,
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  legendBold: { fontFamily: theme.font.bodyBold },
});
