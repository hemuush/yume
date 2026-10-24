import { withPressedTint } from '@/lib/pressed';
import { investLines, type InvestRole } from '@/lib/investment';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { Category, Transaction } from '@/types';
import { JustAddedGlow } from '@/components/JustAddedGlow';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { dayLabel, toLocalIsoDate } from '@/lib/date';
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
  investRole = null,
  showDay = true,
  omitToday = false,
  omitCategory = false,
  dense = false,
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
  /** A transfer into, out of or between investments: worded as Invested, Withdrawn or Moved. */
  investRole?: InvestRole | null;
  /** Off when the rows sit under a day heading (Home), so the day isn't said twice. */
  showDay?: boolean;
  /** Home's list: today is the usual case, so only other days are named. */
  omitToday?: boolean;
  /** Under one category's own screen the category is already known, so the sub line leaves it out. */
  omitCategory?: boolean;
  /** A tighter row for sheets: smaller mark and type, less padding. */
  dense?: boolean;
  currency?: string;
  onPress?: () => void;
}) {
  const { accent, secondary } = useAccent();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const isTransfer = tx.type === 'transfer';
  const note = tx.note?.trim();
  const invest = investRole
    ? investLines(tx, investRole, (id) =>
        id === tx.accountId ? (accountName ?? '—') : (toAccountName ?? '—')
      )
    : null;
  const title = invest ? invest.title : isTransfer ? 'Transfer' : note || category?.name || tx.type;
  // The category goes under a note ("Lunch" / "Food & Dining › Zomato · SBI");
  // A subcategory without a label shows its parent alongside the account.
  const sub = invest
    ? invest.sub
    : isTransfer
      ? `${accountName ?? '—'} → ${toAccountName ?? '—'}`
      : joinSub([
          !omitCategory && (note ? category && categoryPath(category.name, parentName) : parentName),
          accountName,
          showDay && (!omitToday || tx.date !== toLocalIsoDate(new Date())) && dayLabel(tx.date),
        ]);

  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Opens transaction details' : undefined}
      style={
        onPress
          ? withPressedTint(accent, [
              styles.row,
              dense && styles.denseRow,
              stacked && styles.stackedRow,
              divider && styles.divider,
            ])
          : [styles.row, dense && styles.denseRow, stacked && styles.stackedRow, divider && styles.divider]
      }
    >
      <JustAddedGlow ids={[tx.id]} surface="home" />
      <View style={[styles.lead, dense && styles.denseLead]}>
        <CategoryIcon
          name={
            investRole === 'invest'
              ? 'trending-up'
              : investRole === 'withdraw'
                ? 'trending-down'
                : isTransfer
                  ? 'swap-horizontal'
                  : (category?.icon ?? 'tag')
          }
          color={isTransfer ? secondary : (category?.color ?? theme.colors.textMuted)}
          square={dense ? DENSE_MARK : SCREEN.mark}
          size={dense ? 14 : undefined}
          round
        />
      </View>
      <View style={[styles.mid, stacked && styles.stackedMid]}>
        <Text style={[styles.title, dense && styles.denseTitle]}>{title}</Text>
        <Text style={[styles.sub, dense && styles.denseSub]}>
          {tx.isRefund && <Text style={styles.refund}>Refund · </Text>}
          {sub}
        </Text>
      </View>
      {/* Spending reads in ink with its minus; only money in is coloured (green). */}
      <Text style={[styles.amount, dense && styles.denseAmount, tx.type === 'income' && styles.income]}>
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

/** The category disc in a dense row, and the slot it sits in. */
const DENSE_MARK = 32;

const styles = StyleSheet.create({
  row: { ...h.row, gap: 12 },
  denseRow: { minHeight: 48, paddingVertical: 7, paddingHorizontal: 12, gap: 10 },
  denseLead: { width: DENSE_MARK },
  denseTitle: { fontFamily: theme.font.bodyMedium, fontSize: 13.5 },
  denseSub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, marginTop: 1 },
  denseAmount: { fontFamily: theme.font.bodyMedium, fontSize: 13.5 },
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
