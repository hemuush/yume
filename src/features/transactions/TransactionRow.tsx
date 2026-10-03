import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { Category, Transaction } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from './transactions.styles';
import { homeStyles as h } from '@/features/home/homeStyles';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';

const AnimatedRowPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One row in a day's group: sits directly on the page with a hairline bottom border, not in a card.
 * Subtitle is just the account, since the date is the day-group header above the run of rows.
 */
export function TransactionRow({
  tx,
  cat,
  accountName,
  categoryName,
  divider,
  onPress,
  savingsTransfer = false,
}: {
  tx: Transaction;
  cat: Category | undefined;
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  divider: boolean;
  onPress: () => void;
  /** A transfer into or out of a savings account — masked with "hide savings & investment amounts". */
  savingsTransfer?: boolean;
}) {
  const { hideAmounts } = usePrivacy();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedRowPressable
      style={[h.row, divider && h.divider, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <CategoryIcon
        name={tx.type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
        color={tx.type === 'transfer' ? theme.colors.secondary : (cat?.color ?? theme.colors.textMuted)}
      />
      <View style={h.mid}>
        <Text style={h.title} numberOfLines={1}>
          {tx.type === 'transfer' ? (
            `${accountName(tx.accountId)} → ${accountName(tx.toAccountId!)}`
          ) : (
            <>
              {categoryName(tx.categoryId)}
              {!!tx.note && <Text style={styles.rowNoteInline}> · {tx.note}</Text>}
            </>
          )}
        </Text>
        <Text style={h.sub} numberOfLines={1}>
          {tx.isRefund && <Text style={styles.rowRefund}>Refund · </Text>}
          {tx.type === 'transfer' ? 'Own accounts' : accountName(tx.accountId)}
          {tx.splitTotalMinor
            ? ` · Part of a ${formatMaskableMoney(tx.splitTotalMinor, { masked: hideAmounts && !!cat?.isSensitive })} split`
            : ''}
        </Text>
      </View>
      <Text style={[h.amount, tx.type === 'income' && h.income, tx.type === 'expense' && h.expense]}>
        {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
        <Amount minor={tx.amountMinor} sensitive={cat?.isSensitive || savingsTransfer} />
      </Text>
    </AnimatedRowPressable>
  );
}
