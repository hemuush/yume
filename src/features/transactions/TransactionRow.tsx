import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { Category, Transaction } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from './transactions.styles';

const AnimatedRowPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One row in a day's group — sits directly on the page with a hairline
 * bottom border, not inside a card. The date used to live in this row's own
 * subtitle; it's now the day-group header above a whole run of these, so the
 * subtitle here is just the account, the same way Apple Card's own
 * transaction rows carry no per-row date once they're grouped by day.
 */
export function TransactionRow({
  tx,
  cat,
  accountName,
  categoryName,
  divider,
  onPress,
}: {
  tx: Transaction;
  cat: Category | undefined;
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  divider: boolean;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedRowPressable
      style={[styles.flatRow, divider && styles.flatRowDivider, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <CategoryIcon
        name={tx.type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
        color={tx.type === 'transfer' ? theme.colors.secondary : (cat?.color ?? theme.colors.textMuted)}
        square={30}
        size={14}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {tx.type === 'transfer' ? (
            `${accountName(tx.accountId)} → ${accountName(tx.toAccountId!)}`
          ) : (
            <>
              {categoryName(tx.categoryId)}
              {!!tx.note && <Text style={styles.rowNoteInline}> · {tx.note}</Text>}
            </>
          )}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {tx.type === 'transfer' ? 'Own accounts' : accountName(tx.accountId)}
        </Text>
      </View>
      <Text
        style={[
          styles.rowValue,
          tx.type === 'income' && styles.income,
          tx.type === 'expense' && styles.expense,
        ]}
      >
        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
        <Amount minor={tx.amountMinor} sensitive={cat?.isSensitive} />
      </Text>
    </AnimatedRowPressable>
  );
}
