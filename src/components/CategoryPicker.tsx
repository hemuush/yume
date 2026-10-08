import { useEffect, useState } from 'react';
import { View, Pressable, Animated, StyleSheet, Keyboard, LayoutChangeEvent } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import ReanimatedAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Category } from '@/types';
import { theme } from '@/constants/theme';
import { CategoryIcon } from './CategoryIcon';
import { Chip } from './Chip';
import { topLevelOnly, childrenOf, searchCategories } from '@/lib/categoryTree';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { DURATIONS } from '@/lib/motionTimings';
import { withPressed } from '@/lib/pressed';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** The narrowest a medal column gets: the 48px tile, its ring, and room for a short name. */
const MEDAL_MIN_WIDTH = 70;

interface Props {
  /** Already filtered to the relevant kind (income/expense) — this component doesn't filter by kind itself. */
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 'medal' matches the icon-tile picker (New Transaction); 'chip' matches the plain pill picker used elsewhere. */
  variant: 'medal' | 'chip';
  /** Adds "Find a category" above the medal grid. */
  searchable?: boolean;
  /** Tells the host when the search field has the keyboard (Add hides its number pad). */
  onSearchFocusChange?: (focused: boolean) => void;
  /** Shown faded: already used elsewhere (a split's other parts). Still tappable, so the host can say why. */
  dimmedIds?: string[];
}

/**
 * Shows top-level categories only; selecting one with subcategories reveals them in a smaller row beneath,
 * so subcategories ("Zomato" under "Food & Dining") don't each take a slot in the main grid.
 */
export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  variant,
  searchable,
  onSearchFocusChange,
  dimmedIds,
}: Props) {
  const topLevel = topLevelOnly(categories);
  // The medal grid fills its width evenly: as many columns as fit, each an equal share,
  // so a row never ends in a lopsided gap on the right.
  const [gridWidth, setGridWidth] = useState(0);
  const cols = gridWidth > 0 ? Math.max(4, Math.floor(gridWidth / MEDAL_MIN_WIDTH)) : 0;
  const tileWidth = cols > 0 ? Math.floor(gridWidth / cols) : undefined;
  const onGridLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== gridWidth) setGridWidth(w);
  };
  const dimmed = (id: string) => !!dimmedIds?.includes(id);
  const [query, setQuery] = useState('');
  const matches = searchCategories(categories, query);
  const [expandedParentId, setExpandedParentId] = useState<string | null>(() => {
    const selected = categories.find((c) => c.id === selectedId);
    if (!selected) return null;
    return selected.parentId ?? (childrenOf(categories, selected.id).length ? selected.id : null);
  });

  // Keeps the right group expanded when `selectedId` changes from outside (editing a subcategory
  // transaction, or the host form resetting to null), not just on local taps.
  useEffect(() => {
    if (!selectedId) {
      setExpandedParentId(null);
      return;
    }
    const selected = categories.find((c) => c.id === selectedId);
    if (!selected) return;
    if (selected.parentId) setExpandedParentId(selected.parentId);
    else setExpandedParentId(childrenOf(categories, selected.id).length ? selected.id : null);
    // Re-derive only when the selection changes; the caller re-creates `categories` every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // A light tick on every pick, the same one toggles and tabs give.
  const select = (id: string) => {
    haptics.tap();
    onSelect(id);
  };

  const onPressTopLevel = (cat: Category) => {
    select(cat.id);
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
            <Text style={styles.subGroupLabel}>{expandedParent?.name} ›</Text>
            <View style={styles.chipRow}>
              {expandedChildren.map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  active={selectedId === cat.id}
                  onPress={() => select(cat.id)}
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
  const search = searchable && (
    <View style={styles.search}>
      <Feather name="search" size={14} color={theme.colors.textMuted} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Find a category"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.searchInput}
        returnKeyType="done"
        onFocus={() => onSearchFocusChange?.(true)}
        onBlur={() => onSearchFocusChange?.(false)}
        accessibilityLabel="Find a category"
      />
      {query !== '' && (
        <Pressable
          style={withPressed()}
          onPress={() => setQuery('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Feather name="x" size={14} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );

  if (query.trim() !== '') {
    const parentName = (c: Category) =>
      c.parentId ? categories.find((p) => p.id === c.parentId)?.name : undefined;
    return (
      <View>
        {search}
        {matches.length === 0 ? (
          <Text style={styles.noMatch}>No category called "{query.trim()}"</Text>
        ) : (
          <View style={styles.medalGrid} onLayout={onGridLayout}>
            {matches.map((cat) => (
              <MedalTile
                key={cat.id}
                width={tileWidth}
                dimmed={dimmed(cat.id)}
                active={selectedId === cat.id}
                name={cat.name}
                hint={parentName(cat) ? `in ${parentName(cat)}` : undefined}
                icon={cat.icon}
                color={cat.color}
                onPress={() => {
                  select(cat.id);
                  setQuery('');
                  Keyboard.dismiss();
                }}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View>
      {search}
      <View style={styles.medalGrid} onLayout={onGridLayout}>
        {topLevel.map((cat) => (
          <MedalTile
            key={cat.id}
            width={tileWidth}
            dimmed={dimmed(cat.id)}
            active={selectedId === cat.id}
            name={cat.name}
            icon={cat.icon}
            color={cat.color}
            onPress={() => onPressTopLevel(cat)}
          />
        ))}
      </View>
      {expandedChildren.length > 0 && (
        <View style={styles.subGroup}>
          <Text style={styles.subGroupLabel}>{expandedParent?.name} —</Text>
          <View style={styles.medalGrid}>
            {expandedChildren.map((cat, i) => (
              <ReanimatedAnimated.View
                key={cat.id}
                style={tileWidth ? { width: tileWidth } : undefined}
                entering={FadeIn.delay(Math.min(i * DURATIONS.enterStep, MAX_LIST_STAGGER_MS))
                  .duration(DURATIONS.enter)
                  .reduceMotion(ReduceMotion.System)}
              >
                <MedalTile
                  width={tileWidth}
                  dimmed={dimmed(cat.id)}
                  active={selectedId === cat.id}
                  name={cat.name}
                  icon={cat.icon}
                  color={cat.color}
                  onPress={() => select(cat.id)}
                  sub
                />
              </ReanimatedAnimated.View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/** One tile in the medal grid — its own component (not inlined in the .map() above) so each gets its own `usePressScale` instance. */
function MedalTile({
  active,
  name,
  icon,
  color,
  onPress,
  sub,
  hint,
  width,
  dimmed,
}: {
  active: boolean;
  name: string;
  icon: string;
  color: string;
  onPress: () => void;
  sub?: boolean;
  /** A second, quieter line — a search result's parent ("in Travel"). */
  hint?: string;
  /** An equal share of the grid's width; the fixed default until the grid has measured itself. */
  width?: number;
  dimmed?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.92);
  return (
    <AnimatedPressable
      style={[sub ? styles.medalItemSub : styles.medalItem, width != null && { width }, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${name}, ${hint}` : name}
      accessibilityState={{ selected: active }}
    >
      {/* The fade sits on the contents, not the pressable: the press animation drives the pressable's own opacity. */}
      <View style={[styles.medalBody, dimmed && styles.medalDimmed]}>
        <View style={[styles.medalRing, sub && styles.medalRingSub, active && styles.medalRingActive]}>
          <CategoryIcon name={icon} color={color} size={sub ? 16 : 20} square={sub ? 38 : 48} round />
        </View>
        <Text style={styles.medalName} numberOfLines={2}>
          {name}
        </Text>
        {hint && (
          <Text style={styles.medalHint} numberOfLines={1}>
            {hint}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Columns are an equal share of the width (see `cols` above), so only rows need a gap.
  medalGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  medalBody: { alignItems: 'center', alignSelf: 'stretch' },
  medalDimmed: { opacity: 0.35 },
  medalItem: { width: 64, alignItems: 'center' },
  medalItemSub: { width: 56, alignItems: 'center' },
  medalRing: { borderRadius: 30, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  // One consistent "selected" ring across the picker (ink), instead of each
  // tile lighting up in its own category colour.
  medalRingActive: { borderColor: theme.colors.ink },
  medalRingSub: { opacity: 0.88 },
  medalName: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11,
    lineHeight: 13,
    color: theme.colors.textSecondary,
    marginTop: 5,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  medalHint: {
    fontFamily: theme.font.body,
    fontSize: 10.5,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(18,19,15,0.05)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontFamily: theme.font.body,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
  },
  noMatch: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted, paddingVertical: 8 },
  subGroup: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  subGroupLabel: {
    fontSize: 11.5,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
});
