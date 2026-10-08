import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { Category, Transaction } from '@/types';
import { JustAddedGlow } from '@/components/JustAddedGlow';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { dayLabel } from '@/lib/date';
import { categoryPath, inParent, joinSub } from '@/lib/categoryLabel';
import { screenStyles as h } from '@/components/screenStyles';
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
}) {
  const { secondary } = useAccent();
  const isTransfer = tx.type === 'transfer';
  const note = tx.note?.trim();
  const title = isTransfer ? 'Transfer' : note || category?.name || tx.type;
  // The category goes under a note ("Lunch" / "Food & Dining › Zomato · SBI");
  // when the title already is the category, a subcategory says "in Food & Dining" first.
  const sub = isTransfer
    ? `${accountName ?? '—'} → ${toAccountName ?? '—'}`
    : joinSub([
        note ? category && categoryPath(category.name, parentName) : inParent(parentName),
        accountName,
        showDay && dayLabel(tx.date),
      ]);

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <JustAddedGlow ids={[tx.id]} surface="home" />
      <CategoryIcon
        name={isTransfer ? 'swap-horizontal' : (category?.icon ?? 'tag')}
        color={isTransfer ? secondary : (category?.color ?? theme.colors.textMuted)}
        round
      />
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {tx.isRefund && <Text style={styles.refund}>Refund · </Text>}
          {sub}
        </Text>
      </View>
      {/* Spending reads in ink with its minus; only money in is coloured (green). */}
      <Text style={[styles.amount, tx.type === 'income' && styles.income]}>
        {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
        <Amount minor={tx.amountMinor} sensitive={category?.isSensitive || savingsTransfer} />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: h.row,
  divider: h.divider,
  mid: h.mid,
  title: h.title,
  sub: h.sub,
  amount: h.amount,
  income: h.income,
  refund: { fontFamily: theme.font.bodyBold, color: theme.colors.incomeText },
});
