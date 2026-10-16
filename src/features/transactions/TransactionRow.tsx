import { View, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { Category, Transaction } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from './transactions.styles';
import { screenStyles as h } from '@/components/screenStyles';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { dayMonthYear, shortMonth } from '@/lib/dateLabels';

const AnimatedRowPressable = Animated.createAnimatedComponent(Pressable);

/** Note-first entry row; category details opt into date badges and retain subcategory context. */
export function TransactionRow({
  tx,
  cat,
  accountName,
  categoryName,
  divider,
  onPress,
  savingsTransfer = false,
  contextCategoryId,
  currency,
}: {
  tx: Transaction;
  cat: Category | undefined;
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  divider: boolean;
  onPress: () => void;
  /** A transfer into or out of a savings account — masked with "hide savings & investment amounts". */
  savingsTransfer?: boolean;
  /** Category details already name the parent: use a date badge and note-first title. */
  contextCategoryId?: string;
  currency?: string;
}) {
  const { hideAmounts } = usePrivacy();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const title = tx.note?.trim() || categoryName(tx.categoryId);
  const { secondary } = useAccent();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const isTransfer = tx.type === 'transfer';
  // Read aloud as one line, with the amount masked exactly as it is on screen.
  const spokenAmount = formatMaskableMoney(tx.amountMinor, {
    masked: hideAmounts && !!(cat?.isSensitive || savingsTransfer),
    currency,
  });
  const spoken = [
    isTransfer
      ? `Transfer, ${accountName(tx.accountId)} to ${accountName(tx.toAccountId!)}`
      : categoryName(tx.categoryId),
    tx.isRefund ? 'refund' : null,
    tx.type === 'expense'
      ? `spent ${spokenAmount}`
      : tx.type === 'income'
        ? `received ${spokenAmount}`
        : spokenAmount,
    isTransfer ? null : accountName(tx.accountId),
    tx.note || null,
    contextCategoryId ? dayMonthYear(tx.date) : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <AnimatedRowPressable
      style={[h.row, stacked && local.stacked, divider && h.divider, animatedStyle]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {contextCategoryId ? (
        <View
          style={local.dateBadge}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={local.dateDay}>{Number(tx.date.slice(8, 10))}</Text>
          <Text style={local.dateMonth}>{shortMonth(tx.date).toUpperCase()}</Text>
        </View>
      ) : (
        <CategoryIcon
          name={isTransfer ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
          color={isTransfer ? secondary : (cat?.color ?? theme.colors.textMuted)}
        />
      )}
      <View style={[h.mid, stacked && local.wideMid]}>
        <Text style={h.title} numberOfLines={2}>
          {isTransfer ? `${accountName(tx.accountId)} → ${accountName(tx.toAccountId!)}` : title}
        </Text>
        <Text style={h.sub} numberOfLines={1}>
          {tx.isRefund && <Text style={styles.rowRefund}>Refund · </Text>}
          {contextCategoryId && tx.note?.trim() && tx.categoryId !== contextCategoryId
            ? `${categoryName(tx.categoryId)} · `
            : ''}
          {isTransfer ? 'Own accounts' : accountName(tx.accountId)}
          {tx.splitTotalMinor
            ? ` · Part of a ${formatMaskableMoney(tx.splitTotalMinor, { currency, masked: hideAmounts && !!cat?.isSensitive })} split`
            : ''}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          h.amount,
          { maxWidth: '100%', flexShrink: 1 },
          { fontFamily: theme.font.bodyBold, fontVariant: ['tabular-nums'] },
          tx.type === 'income' && h.income,
        ]}
      >
        {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
        <Amount minor={tx.amountMinor} currency={currency} sensitive={cat?.isSensitive || savingsTransfer} />
      </Text>
    </AnimatedRowPressable>
  );
}

const local = StyleSheet.create({
  stacked: { flexWrap: 'wrap', rowGap: 6 },
  wideMid: { flexGrow: 1, flexBasis: '65%' },
  dateBadge: {
    minWidth: 40,
    minHeight: 44,
    padding: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontFamily: theme.font.bodyBold,
    fontVariant: ['tabular-nums'],
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  dateMonth: { fontFamily: theme.font.bodyMedium, fontSize: 10, color: theme.colors.textSecondary },
});
