import type { ActivityFilter } from './activityFilter';
import { listExpenseLabels } from '@/db/expenseLabels';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useEffect, useMemo, useState } from 'react';
import { View, Keyboard } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import type { Account, Category } from '@/types';
import type { ActivityType } from './activityFilter';
import { SheetTabs } from '@/components/SheetTabs';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { orderCategoriesForPicker, topLevelOnly, childrenOf } from '@/lib/categoryTree';
import { styles } from './transactions.styles';
import { theme } from '@/constants/theme';
import { accountHue, accountIcon } from '@/lib/account';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

const FILTER_TYPES: { label: string; value: ActivityType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Invest', value: 'invest' },
];

/** Types with no category or label of their own to filter by. */
const categoryless = (type: ActivityType) => type === 'transfer' || type === 'invest';

/**
 * Type, category and account filters applied client-side on top of the active date range: the range is small,
 * so filtering the fetched list is simpler and as fast as adding SQL filter parameters.
 */
export function FilterModal({
  visible,
  categories,
  accounts,
  filter,
  onClose,
  onApply,
  countFor,
}: {
  visible: boolean;
  categories: Category[];
  accounts: Account[];
  filter: ActivityFilter;
  onClose: () => void;
  onApply: (filter: ActivityFilter) => void;
  /** How many entries a filter would show in the period on screen, for the "Show N entries" button. */
  countFor?: (filter: ActivityFilter) => number;
}) {
  const { accent } = useAccent();
  const { hideAmounts } = usePrivacy();
  const [labels, setLabels] = useState<string[]>([]);
  const { type, categoryIds, accountIds } = filter;
  const [draftLabel, setDraftLabel] = useState(filter.expenseLabel ?? '');
  const [draftType, setDraftType] = useState(type);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>(categoryIds);
  const [draftAccountIds, setDraftAccountIds] = useState<string[]>(accountIds);
  useEffect(() => {
    if (!visible || draftType === 'income' || categoryless(draftType)) return;
    let live = true;
    setLabels([]);
    void listExpenseLabels('', hideAmounts).then(
      (data) => {
        if (live) setLabels(data);
      },
      () => {}
    );
    return () => {
      live = false;
    };
  }, [visible, hideAmounts, draftType]);
  const matchingLabels = labels.filter((label) =>
    label.toLowerCase().includes(draftLabel.trim().toLowerCase())
  );
  const apply = (next: ActivityFilter) => {
    Keyboard.dismiss();
    onApply(next);
  };
  // Which top-level category's subcategory row is expanded; reset on reopen or type change so a stale
  // expansion from a previous session doesn't linger.
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraftLabel(filter.expenseLabel ?? '');
      setDraftType(type);
      setDraftCategoryIds(categoryIds);
      setDraftAccountIds(accountIds);
      setExpandedParentId(null);
    }
  }, [visible, type, categoryIds, accountIds, filter.expenseLabel]);

  // A specific type narrows the categories shown (an income one checked under "Expense" could never match);
  // "All"/"Transfer" show every category, as transfers have none of their own to filter by.
  const visibleCategories = useMemo(() => {
    const scoped =
      draftType === 'income' || draftType === 'expense'
        ? categories.filter((c) => c.kind === draftType)
        : categories;
    return orderCategoriesForPicker(scoped);
  }, [categories, draftType]);

  const topLevelCategories = useMemo(() => topLevelOnly(visibleCategories), [visibleCategories]);
  // An expense and an income category can share a name ("Friends & Family"): say which is which on the chips.
  const sharedNames = useMemo(() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const c of topLevelCategories) (seen.has(c.name) ? dup : seen).add(c.name);
    return dup;
  }, [topLevelCategories]);
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

  const onTypeChange = (next: ActivityType) => {
    setDraftType(next);
    if (next === 'income' || categoryless(next)) setDraftLabel('');
    setExpandedParentId(null);
    // Drop selected categories that no longer match the chosen type: keeping them would silently filter out
    // everything, since a transaction can never match a category of the wrong kind.
    if (categoryless(next)) setDraftCategoryIds([]);
    if (next === 'income' || next === 'expense') {
      setDraftCategoryIds((prev) => prev.filter((id) => categories.find((c) => c.id === id)?.kind === next));
    }
  };

  const draft = {
    type: draftType,
    categoryIds: draftCategoryIds,
    accountIds: draftAccountIds,
    ...(draftLabel.trim() ? { expenseLabel: draftLabel.trim() } : {}),
  };
  // Counted only while the sheet is open: the count scans every transaction, and the sheet stays mounted.
  const count = visible ? countFor?.(draft) : undefined;
  const applyTitle =
    count == null
      ? 'Apply'
      : count === 0
        ? 'Show 0 entries'
        : `Show ${count} ${count === 1 ? 'entry' : 'entries'}`;

  return (
    <ModalSheet
      size="expanded"
      visible={visible}
      onClose={() => {
        Keyboard.dismiss();
        onClose();
      }}
      title="Filter activity"
      subtitle="Refine the entries in your selected period"
      footer={
        <View style={styles.filterFoot}>
          <PrimaryButton
            title="Clear filters"
            variant="secondary"
            onPress={() => apply({ type: 'all', categoryIds: [], accountIds: [] })}
            style={styles.filterClear}
          />
          <PrimaryButton
            title={applyTitle}
            accessibilityLabel={`Apply. ${applyTitle}`}
            onPress={() => apply(draft)}
            style={styles.filterApply}
          />
        </View>
      }
    >
      <Text style={styles.fieldLabel}>Type</Text>
      <SheetTabs options={FILTER_TYPES} value={draftType} onChange={onTypeChange} />

      {accounts.length > 1 && (
        <>
          <Text style={styles.fieldLabel}>Accounts · choose any</Text>
          <View style={styles.chipRow}>
            {accounts.map((acc) => (
              <Chip
                key={acc.id}
                label={acc.name}
                icon={accountIcon(acc.type)}
                iconColor={shade(accountHue(acc.type, accent), 88)}
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

      {!categoryless(draftType) && (
        <>
          <Text style={styles.fieldLabel}>Categories · choose any</Text>
          <View style={styles.chipRow}>
            {topLevelCategories.map((cat) => (
              <Chip
                key={cat.id}
                label={
                  sharedNames.has(cat.name)
                    ? `${cat.name} · ${cat.kind === 'income' ? 'Income' : 'Expense'}`
                    : cat.name
                }
                icon={cat.icon}
                more={childrenOf(visibleCategories, cat.id).length > 0}
                active={draftCategoryIds.includes(cat.id)}
                onPress={() => onToggleTopLevel(cat)}
                activeBorderColor={cat.color}
              />
            ))}
          </View>
          {expandedChildren.length > 0 && (
            <View style={styles.subGroup}>
              <Text style={styles.subGroupLabel}>{expandedParent?.name} ›</Text>
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
      {(draftType === 'all' || draftType === 'expense') && (
        <>
          <Text style={styles.fieldLabel}>Expense label</Text>
          <TextInput
            value={draftLabel}
            onChangeText={setDraftLabel}
            placeholder="Find a label (optional)"
            accessibilityLabel="Filter expense label"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={{
              minHeight: 48,
              padding: 12,
              marginBottom: 12,
              borderRadius: 14,
              backgroundColor: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
            }}
          />
          <View style={styles.chipRow}>
            {matchingLabels.slice(0, 10).map((label) => (
              <Chip
                key={label}
                label={label}
                active={draftLabel === label}
                onPress={() => setDraftLabel(label)}
              />
            ))}
          </View>
        </>
      )}
    </ModalSheet>
  );
}
