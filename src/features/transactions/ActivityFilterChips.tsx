import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { TransactionType } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { styles } from './transactions.styles';
import { withPressed } from '@/lib/pressed';

// The one-tap type choices above the list — the same `filterType` the filter
// sheet sets, just without opening it.
const TYPE_CHIPS: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Spent', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfers', value: 'transfer' },
];

/**
 * Activity's filter: the type as one segmented bar (the same `filterType`
 * the filter sheet sets, without opening it), then one removable chip per
 * category and account being filtered on, and "Clear all" once there's more
 * than one — that second line only while there are some.
 */
export function ActivityFilterChips({
  filterType,
  onFilterType,
  categoryIds,
  accountIds,
  categoryName,
  accountName,
  onRemoveCategory,
  onRemoveAccount,
  onClearAll,
}: {
  filterType: TransactionType | 'all';
  onFilterType: (type: TransactionType | 'all') => void;
  categoryIds: string[];
  accountIds: string[];
  categoryName: (id: string) => string;
  accountName: (id: string) => string;
  onRemoveCategory: (id: string) => void;
  onRemoveAccount: (id: string) => void;
  onClearAll: () => void;
}) {
  const picked = categoryIds.length + accountIds.length;
  return (
    <>
      <View style={styles.typeBar} accessibilityRole="radiogroup">
        {TYPE_CHIPS.map((c) => {
          const on = filterType === c.value;
          return (
            <Pressable
              key={c.value}
              onPress={() => onFilterType(c.value)}
              style={withPressed([styles.typeBtn, on && styles.typeBtnOn])}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Show ${c.label.toLowerCase()}`}
            >
              <Text style={[styles.typeText, on && styles.typeTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {picked > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {categoryIds.map((id) => (
            <Pressable
              key={id}
              onPress={() => onRemoveCategory(id)}
              style={withPressed([styles.chip, styles.chipCat])}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${categoryName(id)} filter`}
            >
              <Text style={styles.chipText}>{categoryName(id)}</Text>
              <Feather name="x" size={12} color={theme.colors.textSecondary} />
            </Pressable>
          ))}
          {accountIds.map((id) => (
            <Pressable
              key={id}
              onPress={() => onRemoveAccount(id)}
              style={withPressed([styles.chip, styles.chipCat])}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${accountName(id)} filter`}
            >
              <Feather name="credit-card" size={11} color={theme.colors.textSecondary} />
              <Text style={styles.chipText}>{accountName(id)}</Text>
              <Feather name="x" size={12} color={theme.colors.textSecondary} />
            </Pressable>
          ))}
          {picked > 1 && (
            <Pressable onPress={onClearAll} style={withPressed(styles.chip)} accessibilityRole="button">
              <Text style={styles.chipText}>Clear all</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
      <View style={styles.filterGap} />
    </>
  );
}

/** What search says before results: type more, searching…, or no matches. Nothing once there are results. */
export function SearchStatus({
  query,
  minChars,
  loading,
  resultCount,
}: {
  query: string;
  minChars: number;
  loading: boolean;
  resultCount: number;
}) {
  if (query.length < minChars) {
    return (
      <EmptyState
        title="Search your transactions"
        subtitle="Matches notes, categories, accounts, amounts (184, ₹1,807) and days (24 Sept) — across your whole history, not just this week or month."
      />
    );
  }
  if (loading) {
    return (
      <View style={styles.searchLoading}>
        <ActivityIndicator color={theme.colors.ink} />
      </View>
    );
  }
  if (resultCount === 0) {
    return (
      <EmptyState
        title={`No matches for "${query}"`}
        subtitle="Try a shorter word, or check the spelling — search looks at each transaction's note, category, account, amount and day."
      />
    );
  }
  return null;
}
