import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Category, Transaction } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';

/**
 * One recent-activity row. Merchant/note leads, "category · account" sits
 * beneath, amount on the right. No date or time — the list is just "what
 * happened lately", scoped to the period shown above.
 */
export function RecentTransactionRow({
  tx,
  category,
  accountName,
  toAccountName,
  divider,
}: {
  tx: Transaction;
  category: Category | undefined;
  accountName: string | undefined;
  toAccountName: string | undefined;
  divider: boolean;
}) {
  const isTransfer = tx.type === 'transfer';
  const note = tx.note?.trim();
  const title = isTransfer ? 'Transfer' : note || category?.name || tx.type;
  const sub = isTransfer
    ? `${accountName ?? '—'} → ${toAccountName ?? '—'}`
    : [category?.name, accountName].filter(Boolean).join(' · ') || undefined;

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <CategoryIcon
        name={isTransfer ? 'swap-horizontal' : (category?.icon ?? 'tag')}
        color={isTransfer ? theme.colors.secondary : (category?.color ?? theme.colors.textMuted)}
      />
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {sub && (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.amount,
          tx.type === 'income' && styles.income,
          tx.type === 'expense' && styles.expense,
        ]}
      >
        {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
        <Amount minor={tx.amountMinor} sensitive={category?.isSensitive} />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 1 },
  amount: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  income: { color: theme.colors.income },
  expense: { color: theme.colors.expense },
});
