import { memo, ReactNode, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
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
import { useStableCallback } from '@/lib/useStableCallback';
import { styles } from './categories.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryTile({
  category,
  context,
  count,
  selected,
  onPress,
  onLongPress,
}: {
  category: Category;
  context?: string;
  /** A parent's subcategory count, shown below its name. */
  count?: number;
  /** The parent whose pills are open below. */
  selected?: boolean;
  /** Both are handed the category, so one function can serve every tile and a tile is drawn again only for its own changes. */
  onPress: (cat: Category) => void;
  onLongPress: (cat: Category) => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const { accent } = useAccent();
  return (
    <View style={[styles.categoryRowShell, selected && styles.tileSelected]}>
      <AnimatedPressable
        style={[styles.tile, animatedStyle]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onPress(category)}
        onLongPress={() => onLongPress(category)}
        accessibilityRole="button"
        accessibilityLabel={
          count
            ? `${category.name}, ${count} subcategor${count === 1 ? 'y' : 'ies'}`
            : context
              ? `${category.name}, in ${context}`
              : category.name
        }
        accessibilityState={count ? { expanded: !!selected } : undefined}
        accessibilityHint={
          category.archived
            ? 'Manage archived category.'
            : count
              ? selected
                ? 'Hide subcategories.'
                : 'Show subcategories.'
              : 'Edit category.'
        }
      >
        <CategoryIcon name={category.icon} color={category.color} square={34} size={16} />
        <View style={styles.tileText}>
          <Text style={styles.tileName}>{category.name}</Text>
          {context && <Text style={styles.tileCount}>{context}</Text>}
          {!!count && (
            <Text style={styles.tileCount}>
              {count} subcategor{count === 1 ? 'y' : 'ies'}
            </Text>
          )}
        </View>
        <Feather
          name={
            count
              ? selected
                ? 'chevron-up'
                : 'chevron-down'
              : category.archived
                ? 'chevron-right'
                : 'edit-2'
          }
          size={16}
          color={theme.colors.textSecondary}
        />
      </AnimatedPressable>
      {!category.archived && (
        <Pressable
          onPress={() => onLongPress(category)}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${category.name}`}
          style={withPressedTint(accent, styles.categoryMore)}
        >
          <Feather name="more-horizontal" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

/** The tile that is drawn again only when what it shows changes. */
export const MemoCategoryTile = memo(CategoryTile);

/** A single list keeps an expanded group attached to its own parent. */
export function CategoryRows<T extends { id: string }>({
  items,
  renderRow,
  panelAfter,
}: {
  items: T[];
  renderRow: (item: T) => ReactNode;
  panelAfter?: (item: T) => ReactNode;
}) {
  return (
    <View style={styles.categoryList}>
      {items.map((item, index) => (
        <MovingRow key={item.id} style={index > 0 ? styles.categoryDivider : undefined}>
          {renderRow(item)}
          {panelAfter?.(item)}
        </MovingRow>
      ))}
    </View>
  );
}

/**
 * Parent rows open their subcategories directly beneath them. A childless row opens its editor.
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
  // One function for every tile (it always acts on the categories as they are now): a parent opens or closes its panel, a
  // childless one is edited.
  const onTile = useStableCallback((cat: Category) => {
    if (childrenOf(cats, cat.id).length) setOpenId((id) => (id === cat.id ? null : cat.id));
    else onEdit(cat);
  });

  return (
    <CategoryRows
      items={topLevel}
      renderRow={(cat) => {
        const kids = childrenOf(cats, cat.id);
        return (
          <MemoCategoryTile
            category={cat}
            count={kids.length || undefined}
            selected={openId === cat.id}
            onPress={onTile}
            onLongPress={onManage}
          />
        );
      }}
      panelAfter={(parent) => {
        if (parent.id !== openId) return null;
        const kids = childrenOf(cats, parent.id);
        return (
          <View style={styles.panelWrap}>
            <View style={styles.panel}>
              <PanelHeader parent={parent} onPress={() => onEdit(parent)} />
              {kids.map((child) => (
                <View key={child.id} style={styles.categoryDivider}>
                  <MemoCategoryTile category={child} onPress={onEdit} onLongPress={onManage} />
                </View>
              ))}
            </View>
          </View>
        );
      }}
    />
  );
}

function PanelHeader({ parent, onPress }: { parent: Category; onPress: () => void }) {
  const { accent } = useAccent();
  return (
    <View style={styles.panelHeader}>
      <View style={styles.panelHeading}>
        <Text style={styles.panelTitle}>Subcategories</Text>
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
    </View>
  );
}
