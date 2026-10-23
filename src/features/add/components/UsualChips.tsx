import { selectedFill } from '@/theme/interactionColors';
import { Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { haptics } from '@/lib/haptics';
import type { RepeatEntry } from '@/db/ledger';
import { CategoryIcon } from '@/components/CategoryIcon';
import { styles } from '@/features/add/add.styles';
import { withPressed } from '@/lib/pressed';
import { categorySpoken } from '@/lib/categoryLabel';
import { useAccent } from '@/theme/AccentContext';

/**
 * "Your usual": recent entries of this type, one tap fills category, amount and account. The name is its own
 * Text so at large text sizes a long name is cut, never the amount.
 */
export function UsualChips({
  usual,
  categoryId,
  amountMinor,
  accountId,
  onPick,
}: {
  usual: RepeatEntry[];
  categoryId: string | null;
  amountMinor: number;
  accountId: string | null;
  onPick: (entry: RepeatEntry) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const { accent } = useAccent();
  const { hideAmounts } = usePrivacy();
  const usualMoney = (u: RepeatEntry) =>
    formatMaskableMoney(u.amountMinor, { currency: u.accountCurrency, masked: hideAmounts && u.isSensitive });
  return (
    <>
      <Text style={styles.label}>Your usual</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.recentRow}
        keyboardShouldPersistTaps="handled"
      >
        {usual.map((u) => {
          const active =
            categoryId === u.categoryId && amountMinor === u.amountMinor && accountId === u.accountId;
          return (
            <Pressable
              key={`${u.categoryId}:${u.amountMinor}:${u.accountId}`}
              onPress={() => {
                haptics.tap();
                onPick(u);
              }}
              hitSlop={{ top: 2, bottom: 2 }}
              style={withPressed([
                styles.recentChip,
                { maxWidth: Math.min(300, 220 * Math.max(1, fontScale)) },
                active && { backgroundColor: selectedFill(accent), borderColor: selectedFill(accent) },
              ])}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${categorySpoken(u.categoryName, u.parentName)}, ${usualMoney(u)}, logged ${u.timesLogged} times`}
            >
              <CategoryIcon name={u.categoryIcon} color={u.categoryColor} size={11} square={20} />
              <Text style={styles.recentChipText} numberOfLines={1}>
                {u.categoryName}
              </Text>
              <Text style={styles.recentChipAmount}>{usualMoney(u)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}
