import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Category } from '@/types';
import { theme } from '@/constants/theme';
import { CategoryIcon } from './CategoryIcon';
import { Chip } from './Chip';
import { topLevelOnly, childrenOf } from '@/lib/categoryTree';

interface Props {
  /** Already filtered to the relevant kind (income/expense) — this component doesn't filter by kind itself. */
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 'medal' matches the icon-tile picker (New Transaction); 'chip' matches the plain pill picker used elsewhere. */
  variant: 'medal' | 'chip';
}

/**
 * Shows top-level categories only, by default — the same ~24-item grid from
 * before subcategories existed. Selecting a category that has subcategories
 * reveals them in a second, smaller row right beneath, so refining to a
 * specific one ("Zomato" under "Food & Dining") is an extra tap away rather
 * than every subcategory permanently occupying a slot in the main grid
 * alongside every top-level category. Replaces three near-duplicate
 * category pickers (New Transaction, Add Past Data, Recurring).
 */
export function CategoryPicker({ categories, selectedId, onSelect, variant }: Props) {
  const topLevel = topLevelOnly(categories);
  const [expandedParentId, setExpandedParentId] = useState<string | null>(() => {
    const selected = categories.find((c) => c.id === selectedId);
    if (!selected) return null;
    return selected.parentId ?? (childrenOf(categories, selected.id).length ? selected.id : null);
  });

  // Keeps the right group expanded when `selectedId` changes from outside
  // this component (editing an existing transaction whose category is a
  // subcategory, or the host form resetting to null) — not just from taps
  // handled locally below.
  useEffect(() => {
    if (!selectedId) {
      setExpandedParentId(null);
      return;
    }
    const selected = categories.find((c) => c.id === selectedId);
    if (!selected) return;
    if (selected.parentId) setExpandedParentId(selected.parentId);
    else setExpandedParentId(childrenOf(categories, selected.id).length ? selected.id : null);
    // Only re-derive when the selection itself changes — `categories` is
    // re-filtered/re-created every render by the caller but its actual
    // contents don't change while a picker is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const onPressTopLevel = (cat: Category) => {
    onSelect(cat.id);
    const kids = childrenOf(categories, cat.id);
    setExpandedParentId(kids.length ? cat.id : null);
  };

  const expandedChildren = expandedParentId ? childrenOf(categories, expandedParentId) : [];
  const expandedParent = expandedParentId ? categories.find((c) => c.id === expandedParentId) : undefined;

  if (variant === 'chip') {
    return (
      <View>
        <View style={styles.chipRow}>
          {topLevel.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              active={selectedId === cat.id}
              onPress={() => onPressTopLevel(cat)}
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
                  active={selectedId === cat.id}
                  onPress={() => onSelect(cat.id)}
                  activeBorderColor={cat.color}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  // 'medal' — the icon-tile picker.
  return (
    <View>
      <View style={styles.medalGrid}>
        {topLevel.map((cat) => {
          const active = selectedId === cat.id;
          return (
            <Pressable key={cat.id} style={styles.medalItem} onPress={() => onPressTopLevel(cat)}>
              <View style={[styles.medalRing, active && styles.medalRingActive]}>
                <CategoryIcon name={cat.icon} color={cat.color} size={20} square={48} />
              </View>
              <Text style={styles.medalName} numberOfLines={1}>
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {expandedChildren.length > 0 && (
        <View style={styles.subGroup}>
          <Text style={styles.subGroupLabel}>{expandedParent?.name} —</Text>
          <View style={styles.medalGrid}>
            {expandedChildren.map((cat) => {
              const active = selectedId === cat.id;
              return (
                <Pressable key={cat.id} style={styles.medalItemSub} onPress={() => onSelect(cat.id)}>
                  <View style={[styles.medalRing, styles.medalRingSub, active && styles.medalRingActive]}>
                    <CategoryIcon name={cat.icon} color={cat.color} size={16} square={38} />
                  </View>
                  <Text style={styles.medalName} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  medalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  medalItem: { width: 64, alignItems: 'center' },
  medalItemSub: { width: 56, alignItems: 'center' },
  medalRing: { borderRadius: 16, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  // One consistent "selected" ring across the picker (mint), instead of each
  // tile lighting up in its own category colour.
  medalRingActive: { borderColor: theme.colors.secondary },
  medalRingSub: { opacity: 0.88 },
  medalName: {
    fontFamily: theme.font.rounded,
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    marginTop: 5,
    textAlign: 'center',
  },
  subGroup: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.borderSoft,
  },
  subGroupLabel: {
    fontSize: 11.5,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
});
