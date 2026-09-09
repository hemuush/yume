import { View, Text, Pressable, Animated } from 'react-native';
import { Category, Transaction } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from './transactions.styles';

const AnimatedRowPressable = Animated.createAnimatedComponent(Pressable);

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
      style={[styles.row, divider && styles.rowDivider, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <CategoryIcon
        name={tx.type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
        color={tx.type === 'transfer' ? theme.colors.secondary : (cat?.color ?? theme.colors.textMuted)}
        square={36}
        size={16}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {tx.type === 'transfer' ? (
            `${accountName(tx.accountId)} → ${accountName(tx.toAccountId!)}`
          ) : (
            <>
              {categoryName(tx.categoryId)}
              {/* The note (e.g. "YT Premium" under Entertainment) sits right
                  next to the category it belongs to, not three fields deep
                  in the subtitle where a longer date/account string could
                  truncate it out of view entirely. */}
              {!!tx.note && <Text style={styles.rowNoteInline}> · {tx.note}</Text>}
            </>
          )}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {tx.date} · {accountName(tx.accountId)}
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
