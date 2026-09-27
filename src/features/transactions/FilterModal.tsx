import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { Account, Category, TransactionType } from '@/types';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { orderCategoriesForPicker, topLevelOnly, childrenOf } from '@/lib/categoryTree';
import { styles } from './transactions.styles';

const FILTER_TYPES: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
];

/** What Activity is filtered to — see FilterModal. */
export interface ActivityFilter {
  type: TransactionType | 'all';
  categoryIds: string[];
  /** A transfer matches either of its accounts. */
  accountIds: string[];
}

/**
 * Type, category and account filters, applied client-side on top of whatever date
 * range (day/week/month) is already active — the visible range is usually
 * small enough that filtering the already-fetched list is simpler and just
 * as fast as adding more SQL filter parameters.
 */
export function FilterModal({
  visible,
  categories,
  accounts,
  filter,
  onClose,
  onApply,
}: {
  visible: boolean;
  categories: Category[];
  accounts: Account[];
  filter: ActivityFilter;
  onClose: () => void;
  onApply: (filter: ActivityFilter) => void;
}) {
  const { type, categoryIds, accountIds } = filter;
  const [draftType, setDraftType] = useState(type);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>(categoryIds);
  const [draftAccountIds, setDraftAccountIds] = useState<string[]>(accountIds);
  // Which top-level category's subcategory row is currently expanded — reset
  // whenever the modal reopens or the type filter changes so a stale
  // expansion from a previous session doesn't linger.
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraftType(type);
      setDraftCategoryIds(categoryIds);
      setDraftAccountIds(accountIds);
      setExpandedParentId(null);
    }
  }, [visible, type, categoryIds, accountIds]);

  // Selecting a specific type narrows which categories make sense to show
  // (an income category checked while "Expense" is picked could never match
  // anything); "All" or "Transfer" show every category since transfers have
  // none of their own to filter by anyway.
  const visibleCategories = useMemo(() => {
    const scoped =
      draftType === 'income' || draftType === 'expense'
        ? categories.filter((c) => c.kind === draftType)
        : categories;
    return orderCategoriesForPicker(scoped);
  }, [categories, draftType]);

  const topLevelCategories = useMemo(() => topLevelOnly(visibleCategories), [visibleCategories]);
  const expandedChildren = expandedParentId ? childrenOf(visibleCategories, expandedParentId) : [];
  const expandedParent = expandedParentId
    ? visibleCategories.find((c) => c.id === expandedParentId)
    : undefined;

  const toggleCategory = (id: string) => {
    setDraftCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const onToggleTopLevel = (cat: Category) => {
    toggleCategory(cat.id);
    const kids = childrenOf(visibleCategories, cat.id);
    setExpandedParentId(kids.length ? cat.id : null);
  };

  const onTypeChange = (next: TransactionType | 'all') => {
    setDraftType(next);
    setExpandedParentId(null);
    // Dropping any selected category that no longer matches the chosen type
    // — keeping it selected would silently filter out everything, since a
    // transaction can never match a category of the wrong kind.
    if (next === 'income' || next === 'expense') {
      setDraftCategoryIds((prev) => prev.filter((id) => categories.find((c) => c.id === id)?.kind === next));
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="Filter transactions"
      footer={
        <View style={f.footerRow}>
          <PrimaryButton
            title="Clear filters"
            variant="secondary"
            onPress={() => onApply({ type: 'all', categoryIds: [], accountIds: [] })}
            style={f.footerBtn}
          />
          <PrimaryButton
            title="Apply"
            onPress={() =>
              onApply({ type: draftType, categoryIds: draftCategoryIds, accountIds: draftAccountIds })
            }
            style={f.footerBtn}
          />
        </View>
      }
    >
      <Text style={styles.fieldLabel}>Type</Text>
      <SegmentedControl options={FILTER_TYPES} value={draftType} onChange={onTypeChange} />

      {accounts.length > 1 && (
        <>
          <Text style={styles.fieldLabel}>Account</Text>
          <View style={styles.chipRow}>
            {accounts.map((acc) => (
              <Chip
                key={acc.id}
                label={acc.name}
                active={draftAccountIds.includes(acc.id)}
                onPress={() =>
                  setDraftAccountIds((prev) =>
                    prev.includes(acc.id) ? prev.filter((id) => id !== acc.id) : [...prev, acc.id]
                  )
                }
              />
            ))}
          </View>
        </>
      )}

      {draftType !== 'transfer' && (
        <>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.chipRow}>
            {topLevelCategories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                active={draftCategoryIds.includes(cat.id)}
                onPress={() => onToggleTopLevel(cat)}
                activeBorderColor={cat.color}
              />
            ))}
          </View>
          {expandedChildren.length > 0 && (
            <View style={styles.subGroup}>
              <Text style={styles.subGroupLabel}>{expandedParent?.name} —</Text>
              <View style={styles.chipRow}>
                {expandedChildren.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={cat.name}
                    active={draftCategoryIds.includes(cat.id)}
                    onPress={() => toggleCategory(cat.id)}
                    activeBorderColor={cat.color}
                  />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ModalSheet>
  );
}
