import { Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Account } from '@/types';
import { Amount } from '@/components/Amount';
import { FlatIconBadge } from '@/components/FlatIconBadge';
import { SoftCard } from './SoftCard';

const ACCOUNT_ICON: Record<Account['type'], string> = {
  bank: 'bank',
  cash: 'cash',
  wallet: 'wallet',
  credit_card: 'credit-card',
  savings: 'piggy-bank',
};

/** One account in the horizontal "Your accounts" strip. */
export function AccountChip({ account, fill }: { account: Account; fill: string }) {
  return (
    <SoftCard backgroundColor={fill} padding={14} style={styles.card}>
      <FlatIconBadge name={ACCOUNT_ICON[account.type] ?? 'credit-card'} />
      <Text style={styles.name} numberOfLines={1}>
        {account.name}
      </Text>
      <Amount
        minor={account.currentBalanceMinor}
        currency={account.currency}
        sensitive={account.type === 'savings'}
        style={styles.balance}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      <Text style={styles.type}>{account.type.replace('_', ' ')}</Text>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: { width: 150 },
  name: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.onFlat, marginTop: 10 },
  balance: { fontFamily: theme.font.monoBold, fontSize: 15, color: theme.colors.onFlat, marginTop: 8 },
  type: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.onFlat,
    opacity: 0.6,
    marginTop: 6,
    textTransform: 'capitalize',
  },
});
