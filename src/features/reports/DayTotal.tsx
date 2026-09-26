import { View } from 'react-native';
import { Text } from '@/components/Text';
import { Transaction } from '@/types';
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { summariseDayTotal } from './reportsInsights';
import { styles } from './reports.styles';

/** The pinned footer of the day-detail popup — the day's net, or its total spend. */
export function DayTotal({ txs }: { txs: Transaction[] }) {
  const { label, amountMinor, sign } = summariseDayTotal(txs);
  return (
    <View style={styles.dayTotalRow}>
      <Text style={styles.dayTotalLabel}>{label}</Text>
      <Text
        style={[
          styles.dayTotalValue,
          { color: sign === '+' ? theme.colors.income : theme.colors.idCoralDeep },
        ]}
      >
        {sign}
        {formatMoney(amountMinor)}
      </Text>
    </View>
  );
}
