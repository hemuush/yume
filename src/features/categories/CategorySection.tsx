import { ReactNode, useState } from 'react';
import { View, Pressable, Animated, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { withPressedTint } from '@/lib/pressed';
import { MovingRow } from '@/components/MovingRow';
import { Text } from '@/components/Text';
import { Category } from '@/types';
import { topLevelOnly, childrenOf } from '@/lib/categoryTree';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useAccent } from '@/theme/AccentContext';
import { usePressScale } from '@/lib/usePressScale';
import { styles, TILE_COLUMNS } from './categories.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryTile({
  category,
  isSubcategory,
  count,
  selected,
  onPress,
  onLongPress,
}: {
  category: Category;
  isSubcategory?: boolean;
  /** A parent's subcategory count, shown as a small badge. */
  count?: number;
  /** The parent whose pills are open below. */
  selected?: boolean;
  onPress: () => void;
  onLongPress: (cat: Category) => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.tile, animatedStyle]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      onLongPress={() => onLongPress(category)}
      accessibilityRole="button"
      accessibilityLabel={
        count ? `${category.name}, ${count} subcategor${count === 1 ? 'y' : 'ies'}` : category.name
      }
      accessibilityState={count ? { expanded: !!selected } : undefined}
    >
      <View style={[styles.tileRing, selected && styles.tileRingOn]}>
        <CategoryIcon
          name={category.icon}
          color={category.color}
          square={isSubcategory ? 40 : 44}
          size={isSubcategory ? 18 : 20}
          round
        />
        {!!count && (
          <View style={styles.tileBadge}>
            <Text style={styles.tileBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.tileName}>{isSubcategory ? `↳ ${category.name}` : category.name}</Text>
    </AnimatedPressable>
  );
}

function SubcategoryPill({
  category,
  onPress,
  onLongPress,
}: {
  category: Category;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.pill, animatedStyle]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${category.name}, subcategory`}
      accessibilityHint="Press and hold for more options"
    >
      <View style={[styles.pillDot, { backgroundColor: category.color }]} />
      <Text style={styles.pillText}>{category.name}</Text>
    </AnimatedPressable>
  );
}

/**
 * Tiles in four columns, or two on narrow screens and with enlarged text. `panelAfter` can return a panel to open under a row (given that row's items
 * and the column to point at), which is why the rows are built here rather than left to a wrapping flex.
 */
export function TileRows<T extends { id: string }>({
  items,
  renderTile,
  panelAfter,
}: {
  items: T[];
  renderTile: (item: T) => ReactNode;
  panelAfter?: (rowItems: T[], columns: number) => ReactNode;
}) {
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 360 || fontScale > 1.2 ? 2 : TILE_COLUMNS;
  const cellStyle = { width: `${100 / columns}%` as `${number}%` };
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <MovingRow key={row[0].id}>
          <View style={styles.gridRow}>
            {row.map((item) => (
              <View key={item.id} style={[styles.cell, cellStyle]}>
                {renderTile(item)}
              </View>
            ))}
            {Array.from({ length: columns - row.length }, (_, i) => (
              <View key={`pad-${i}`} style={[styles.cell, cellStyle]} />
            ))}
          </View>
          {panelAfter?.(row, columns)}
        </MovingRow>
      ))}
    </View>
  );
}

/**
 * Every top-level category as a tile, A to Z, in adaptive rows. A parent shows its subcategory count; tapping it
 * opens its pills in a panel under that row (and the panel's header edits the parent), a childless one edits.
 */
export function CategorySection({
  cats,
  onEdit,
  onManage,
}: {
  cats: Category[];
  onEdit: (cat: Category) => void;
  onManage: (cat: Category) => void;
}) {
  const topLevel = topLevelOnly(cats);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <TileRows
      items={topLevel}
      renderTile={(cat) => {
        const kids = childrenOf(cats, cat.id);
        return (
          <CategoryTile
            category={cat}
            count={kids.length || undefined}
            selected={openId === cat.id}
            onPress={() => (kids.length ? setOpenId((id) => (id === cat.id ? null : cat.id)) : onEdit(cat))}
            onLongPress={onManage}
          />
        );
      }}
      panelAfter={(row, columns) => {
        const index = row.findIndex((c) => c.id === openId);
        if (index < 0) return null;
        const parent = row[index];
        const kids = childrenOf(cats, parent.id);
        return (
          <View style={styles.panelWrap}>
            <View style={[styles.notch, { left: `${(index + 0.5) * (100 / columns)}%` }]} />
            <View style={styles.panel}>
              <PanelHeader
                parent={parent}
                count={kids.length}
                onPress={() => onEdit(parent)}
                onLongPress={() => onManage(parent)}
              />
              <View style={styles.pillRow}>
                {kids.map((child) => (
                  <SubcategoryPill
                    key={child.id}
                    category={child}
                    onPress={() => onEdit(child)}
                    onLongPress={() => onManage(child)}
                  />
                ))}
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

function PanelHeader({
  parent,
  count,
  onPress,
  onLongPress,
}: {
  parent: Category;
  count: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { accent } = useAccent();
  return (
    <View style={styles.panelHeader}>
      <View style={styles.panelHeading}>
        <Text style={styles.panelTitle}>{parent.name}</Text>
        <Text style={styles.panelCount}>
          {count} subcategor{count === 1 ? 'y' : 'ies'}
        </Text>
      </View>
      <Pressable
        onPress={onPress}
        style={withPressedTint(accent, styles.parentEdit)}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${parent.name}`}
      >
        <Feather name="edit-2" size={15} color={theme.colors.ink} />
        <Text style={styles.parentEditText}>Edit</Text>
      </Pressable>
      <Pressable
        onPress={onLongPress}
        style={withPressedTint(accent, styles.parentMore)}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${parent.name}`}
      >
        <Feather name="more-horizontal" size={19} color={theme.colors.ink} />
      </Pressable>
    </View>
  );
}
