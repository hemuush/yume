import { selectedFill } from '@/theme/interactionColors';
import { View, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { HeaderIconButton } from '@/components/AppHeader';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { TransactionType } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { styles } from './transactions.styles';
import { withPressed } from '@/lib/pressed';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

// The one-tap type choices above the list — the same `filterType` the filter
// sheet sets, just without opening it.
const TYPE_CHIPS: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Spent', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfers', value: 'transfer' },
];

/**
 * Activity's filter: type segmented bar (the sheet's `filterType`), then a chip per filtered
 * category/account. "Clear all" appears once there's more than one chip.
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
  onOpenFilters,
  filterCount = 0,
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
  onOpenFilters?: () => void;
  filterCount?: number;
}) {
  const picked = categoryIds.length + accountIds.length + (filterType === 'all' ? 0 : 1);
  const { accent } = useAccent();
  const chipBg = shade(accent, 95);
  const { width, fontScale } = useWindowDimensions();
  const wrapTabs = width < 360 || fontScale > 1.2;
  return (
    <>
      <View style={styles.typeFilterRow}>
        <View style={[styles.typeBar, wrapTabs && { flexWrap: 'wrap' }]} accessibilityRole="radiogroup">
          {TYPE_CHIPS.map((c) => {
            const on = filterType === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => onFilterType(c.value)}
                style={withPressed([
                  styles.typeBtn,
                  wrapTabs && { flexBasis: '40%' },
                  on && { backgroundColor: selectedFill(accent) },
                ])}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Show ${c.label.toLowerCase()}`}
              >
                <Text style={[styles.typeText, on && styles.typeTextOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {onOpenFilters && (
          <HeaderIconButton
            icon="sliders"
            size={52}
            glass
            onPress={onOpenFilters}
            label={filterCount > 0 ? `Filters, ${filterCount} on` : 'Filters'}
            count={filterCount}
          />
        )}
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
              style={withPressed([styles.chip, { backgroundColor: chipBg }])}
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
              style={withPressed([styles.chip, { backgroundColor: chipBg }])}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${accountName(id)} filter`}
            >
              <Feather name="credit-card" size={11} color={theme.colors.textSecondary} />
              <Text style={styles.chipText}>{accountName(id)}</Text>
              <Feather name="x" size={12} color={theme.colors.textSecondary} />
            </Pressable>
          ))}
          {picked > 0 && (
            <Pressable
              onPress={onClearAll}
              style={withPressed(styles.chip)}
              accessibilityRole="button"
              accessibilityLabel="Clear all Activity filters"
            >
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
  failed = false,
  onRetry,
  suggestions = [],
  recent = [],
  onPick,
  onClearRecent,
}: {
  query: string;
  minChars: number;
  loading: boolean;
  resultCount: number;
  failed?: boolean;
  onRetry?: () => void;
  /** Things to try, from the user's own entries (a category, an amount, a day). */
  suggestions?: string[];
  /** Past searches, newest first. */
  recent?: string[];
  onPick?: (query: string) => void;
  onClearRecent?: () => void;
}) {
  if (query.length < minChars) {
    return (
      <View style={styles.searchEmpty}>
        <View style={styles.searchEmptyIcon}>
          <Feather name="search" size={22} color={theme.colors.ink} />
        </View>
        <Text style={styles.searchEmptyTitle}>Search everything</Text>
        <Text style={styles.searchEmptySub}>
          Labels, notes, categories, accounts, amounts and days, across your whole history.
        </Text>
        {suggestions.length > 0 && (
          <View style={styles.searchSuggest}>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                onPress={() => onPick?.(s)}
                style={withPressed(styles.searchSuggestChip)}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${s}`}
              >
                <Text style={styles.searchSuggestText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {recent.length > 0 && (
          <View style={styles.recentWrap}>
            <View style={styles.recentHead}>
              <Text style={styles.recentLabel}>Recent</Text>
              {onClearRecent && (
                <Pressable
                  onPress={onClearRecent}
                  style={withPressed(styles.searchClear)}
                  accessibilityRole="button"
                  accessibilityLabel="Clear recent searches"
                >
                  <Text style={styles.recentClear}>Clear</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.recentCard}>
              {recent.map((q, i) => (
                <Pressable
                  key={q}
                  onPress={() => onPick?.(q)}
                  style={withPressed([styles.recentRow, i > 0 && styles.recentDivider])}
                  accessibilityRole="button"
                  accessibilityLabel={`Search again for ${q}`}
                >
                  <Feather name="clock" size={15} color={theme.colors.textMuted} />
                  <Text style={styles.recentText}>{q}</Text>
                  <Feather name="arrow-up-left" size={15} color={theme.colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.searchLoading}>
        <ActivityIndicator color={theme.colors.ink} />
      </View>
    );
  }
  if (failed) {
    return (
      <View style={styles.searchEmpty}>
        <Text style={styles.searchEmptyTitle}>Couldn't search</Text>
        <Text style={styles.searchEmptySub}>Your entries haven't changed. Please try again.</Text>
        <Pressable onPress={onRetry} accessibilityRole="button" style={withPressed(styles.searchSuggestChip)}>
          <Text style={styles.searchSuggestText}>Retry search</Text>
        </Pressable>
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
