import { useState } from 'react';
import { View, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LapsedBudget } from '@/db/budgets';
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { categorySentence } from '@/lib/categoryLabel';
import { styles } from './budgets.styles';

/**
 * Last month's budgets that have no budget this month. One pill carries them
 * all over; the chevron opens the list to continue them one by one.
 */
export function LapsedBudgetsCard({
  items,
  continuingId,
  continuingAll,
  onContinue,
  onContinueAll,
  style,
}: {
  items: LapsedBudget[];
  continuingId: string | null;
  continuingAll: boolean;
  onContinue: (item: LapsedBudget) => void;
  onContinueAll: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const many = items.length > 1;
  const busy = continuingAll || continuingId != null;

  return (
    <View style={[styles.lapsedCard, style]}>
      <View style={styles.lapsedHead}>
        <View style={styles.lapsedHeadText}>
          <Text style={styles.lapsedTitle} numberOfLines={1}>
            {items.length} {items.length === 1 ? 'budget' : 'budgets'} ended last month
          </Text>
          <Text style={styles.lapsedNames} numberOfLines={1}>
            {items.map((i) => categorySentence(i.categoryName, i.parentName)).join(' · ')}
          </Text>
        </View>
        <Pressable
          style={withPressed(styles.continueBtn)}
          onPress={onContinueAll}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={many ? 'Continue all budgets' : 'Continue budget'}
        >
          <Text style={styles.continueBtnText}>
            {continuingAll ? '…' : many ? 'Continue all' : 'Continue'}
          </Text>
        </Pressable>
        {many && (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            hitSlop={10}
            style={withPressed(styles.lapsedChevron)}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Hide the list' : 'Choose which to continue'}
            accessibilityState={{ expanded: open }}
          >
            <Feather
              name={open ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        )}
      </View>
      {open &&
        items.map((item) => (
          <View key={item.categoryId} style={styles.lapsedRow}>
            <CategoryIcon name={item.categoryIcon} color={item.categoryColor} square={30} size={14} />
            <Text style={styles.lapsedName} numberOfLines={1}>
              {categorySentence(item.categoryName, item.parentName)}
            </Text>
            <Text style={styles.lapsedAmount}>{formatMoney(item.limitAmountMinor)}/mo</Text>
            <Pressable
              style={withPressed(styles.continueBtn)}
              onPress={() => onContinue(item)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Continue ${categorySentence(item.categoryName, item.parentName)} budget`}
              accessibilityState={{ disabled: busy, busy: continuingId === item.categoryId }}
            >
              <Text style={styles.continueBtnText}>
                {continuingId === item.categoryId ? '…' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        ))}
    </View>
  );
}
