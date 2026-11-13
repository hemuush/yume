import { themeInk } from '@/theme/interactionColors';
import { View, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { HeaderIconButton } from '@/components/AppHeader';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import type { ActivityType } from './activityFilter';
import { EmptyState } from '@/components/EmptyState';
import { styles } from './transactions.styles';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

// The one-tap type choices above the list — the same `filterType` the filter
// sheet sets, just without opening it.
// Investments are one of the types too, but a rare one: they live in the filter sheet, not on this row.
const TYPE_CHIPS: { label: string; value: ActivityType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Spent', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfers', value: 'transfer' },
];

/**
 * Activity's filter row: the Filters button, the one-tap type choices (the sheet's `filterType`), then a
 * removable chip per picked category/account/label, and Clear all last. Only the type choices form the radio
 * group.
 */
export function ActivityFilterChips({
  filterType,
  onFilterType,
  categoryIds,
  accountIds,
  expenseLabel,
  categoryName,
  accountName,
  onRemoveCategory,
  onRemoveAccount,
  onRemoveLabel,
  onClearAll,
  onOpenFilters,
  filterCount = 0,
}: {
  filterType: ActivityType;
  onFilterType: (type: ActivityType) => void;
  categoryIds: string[];
  accountIds: string[];
  /** An expense label picked in the filter sheet; it is a chip like the categories and accounts. */
  expenseLabel?: string;
  categoryName: (id: string) => string;
  accountName: (id: string) => string;
  onRemoveCategory: (id: string) => void;
  onRemoveAccount: (id: string) => void;
  onRemoveLabel?: () => void;
  onClearAll: () => void;
  onOpenFilters?: () => void;
  filterCount?: number;
}) {
  const picked =
    categoryIds.length + accountIds.length + (expenseLabel ? 1 : 0) + (filterType === 'all' ? 0 : 1);
  const { accent } = useAccent();
  const chipBg = shade(accent, 95);
  const ink = themeInk(accent);
  const { width, fontScale } = useWindowDimensions();
  const wrapTabs = width < 360 || fontScale > 1.2;
  // Investments are picked in the sheet, so their chip shows only while that is the type in use: otherwise
  // the row would show no choice at all (not even All) on a filtered list.
  const chips =
    filterType === 'invest' ? [...TYPE_CHIPS, { label: 'Invest', value: 'invest' as const }] : TYPE_CHIPS;
  const pills = chips.map((c) => {
    const on = filterType === c.value;
    return (
      <Pressable
        key={c.value}
        onPress={() => onFilterType(c.value)}
        // Drawn 40 tall; the touch area stays 48.
        hitSlop={{ top: 4, bottom: 4 }}
        style={withPressedTint(accent, [styles.typeBtn, on && { backgroundColor: ink, borderColor: ink }])}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`Show ${c.label.toLowerCase()}`}
      >
        <Text style={[styles.typeText, on && styles.typeTextOn]}>{c.label}</Text>
      </Pressable>
    );
  });
  // One row, the stable controls first and what has been picked after them: Filters (with its count), the
  // one-tap types, then a removable chip for each thing picked, and Clear all at the end. Whatever is picked
  // (a type, or any number of categories, accounts and a label) only ever adds to the end of the row, so the
  // types stay where the thumb found them and are never pushed off screen by a long list of chips. At large
  // text it wraps instead of scrolling.
  const pickedChips = picked > 0 && (
    <>
      {categoryIds.map((id) => (
        <Pressable
          key={id}
          onPress={() => onRemoveCategory(id)}
          style={withPressedTint(accent, [styles.chip, { backgroundColor: chipBg }])}
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
          style={withPressedTint(accent, [styles.chip, { backgroundColor: chipBg }])}
          accessibilityRole="button"
          accessibilityLabel={`Remove the ${accountName(id)} filter`}
        >
          <Feather name="credit-card" size={11} color={theme.colors.textSecondary} />
          <Text style={styles.chipText}>{accountName(id)}</Text>
          <Feather name="x" size={12} color={theme.colors.textSecondary} />
        </Pressable>
      ))}
      {!!expenseLabel && (
        <Pressable
          onPress={onRemoveLabel}
          style={withPressedTint(accent, [styles.chip, { backgroundColor: chipBg }])}
          accessibilityRole="button"
          accessibilityLabel="Remove expense label filter"
        >
          <Text style={styles.chipText}>Label: {expenseLabel}</Text>
          <Feather name="x" size={12} color={theme.colors.textSecondary} />
        </Pressable>
      )}
    </>
  );
  const clearAll = picked > 0 && (
    <Pressable
      onPress={onClearAll}
      style={withPressedTint(accent, styles.chip)}
      accessibilityRole="button"
      accessibilityLabel="Clear all Activity filters"
    >
      <Text style={styles.chipText}>Clear all</Text>
    </Pressable>
  );
  const filterButton = onOpenFilters && (
    <HeaderIconButton
      icon="sliders"
      size={40}
      glass
      onPress={onOpenFilters}
      label={filterCount > 0 ? `Filters, ${filterCount} on` : 'Filters'}
      count={filterCount}
    />
  );
  return (
    <>
      {wrapTabs ? (
        <View style={[styles.typeBar, styles.typeFilterRowWrap]}>
          {filterButton}
          {pills}
          {pickedChips}
          {clearAll}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.typeBar, styles.typeFilterRow]}
        >
          {filterButton}
          <View style={styles.pillGroup} accessibilityRole="radiogroup">
            {pills}
          </View>
          {pickedChips}
          {clearAll}
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
  capped = false,
  limit,
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
  /** More entries matched than the list shows. */
  capped?: boolean;
  /** How many the list holds, named when it is capped. */
  limit?: number;
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
        <Text style={styles.searchEmptyTitle}>Couldn’t search</Text>
        <Text style={styles.searchEmptySub}>Your entries haven’t changed. Please try again.</Text>
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
        subtitle="Try a shorter word, or check the spelling — search looks at each transaction’s note, category, account, amount and day."
      />
    );
  }
  // With results: how many, so the list below is not a guess. A capped list says it is the newest, and how to see
  // the rest (a longer search narrows it).
  return (
    <Text style={styles.searchCount} accessibilityLiveRegion="polite">
      {capped
        ? `Newest ${limit ?? resultCount} matches. Add a word to narrow it.`
        : `${resultCount} ${resultCount === 1 ? 'match' : 'matches'}`}
    </Text>
  );
}
