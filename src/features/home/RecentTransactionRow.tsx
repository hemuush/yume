import { withPressed } from '@/lib/pressed';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { Category, Transaction } from '@/types';
import { JustAddedGlow } from '@/components/JustAddedGlow';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { dayLabel } from '@/lib/date';
import { categoryPath, joinSub } from '@/lib/categoryLabel';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';
import { useAccent } from '@/theme/AccentContext';

/**
 * One recent-activity row: merchant/note leads, "category · account · day" beneath, amount right.
 * The day is "Today", "Yesterday" or a short date, never a time.
 */
export function RecentTransactionRow({
  tx,
  category,
  parentName,
  accountName,
  toAccountName,
  divider,
  savingsTransfer = false,
  showDay = true,
  currency,
  onPress,
}: {
  tx: Transaction;
  category: Category | undefined;
  /** The category's parent when it is a subcategory, so same-named subcategories can be told apart. */
  parentName?: string;
  accountName: string | undefined;
  toAccountName: string | undefined;
  divider: boolean;
  /** A transfer into or out of a savings account — masked with "hide savings & investment amounts". */
  savingsTransfer?: boolean;
  /** Off when the rows sit under a day heading (Home), so the day isn't said twice. */
  showDay?: boolean;
  currency?: string;
  onPress?: () => void;
}) {
  const { secondary } = useAccent();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const isTransfer = tx.type === 'transfer';
  const note = tx.note?.trim();
  const title = isTransfer ? 'Transfer' : note || category?.name || tx.type;
  // The category goes under a note ("Lunch" / "Food & Dining › Zomato · SBI");
  // A subcategory without a label shows its parent alongside the account.
  const sub = isTransfer
    ? `${accountName ?? '—'} → ${toAccountName ?? '—'}`
    : joinSub([
        note ? category && categoryPath(category.name, parentName) : parentName,
        accountName,
        showDay && dayLabel(tx.date),
      ]);

  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Opens transaction details' : undefined}
      style={
        onPress
          ? withPressed([styles.row, stacked && styles.stackedRow, divider && styles.divider])
          : [styles.row, stacked && styles.stackedRow, divider && styles.divider]
      }
    >
      <JustAddedGlow ids={[tx.id]} surface="home" />
      <View style={styles.lead}>
        <CategoryIcon
          name={isTransfer ? 'swap-horizontal' : (category?.icon ?? 'tag')}
          color={isTransfer ? secondary : (category?.color ?? theme.colors.textMuted)}
          square={SCREEN.mark}
          round
        />
      </View>
      <View style={[styles.mid, stacked && styles.stackedMid]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          {tx.isRefund && <Text style={styles.refund}>Refund · </Text>}
          {sub}
        </Text>
      </View>
      {/* Spending reads in ink with its minus; only money in is coloured (green). */}
      <Text style={[styles.amount, tx.type === 'income' && styles.income]}>
        {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
        <Amount
          minor={tx.amountMinor}
          sensitive={category?.isSensitive || savingsTransfer}
          currency={currency}
        />
      </Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: { ...h.row, gap: 12 },
  lead: { width: SCREEN.lead, alignItems: 'center', justifyContent: 'center' },
  stackedRow: { flexWrap: 'wrap', rowGap: 6 },
  stackedMid: { flexGrow: 1, flexBasis: '70%' },
  divider: h.divider,
  mid: h.mid,
  title: h.title,
  sub: h.sub,
  amount: { ...h.amount, fontFamily: theme.font.bodyBold, fontVariant: ['tabular-nums'] },
  income: h.income,
  refund: { fontFamily: theme.font.bodyBold, color: theme.colors.incomeText },
});
