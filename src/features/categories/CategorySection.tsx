import { View, Pressable, Animated } from 'react-native';
import { MovingRow } from '@/components/MovingRow';
import { Text } from '@/components/Text';
import { Category } from '@/types';
import { topLevelOnly, childrenOf } from '@/lib/categoryTree';
import { CategoryIcon } from '@/components/CategoryIcon';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from './categories.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryTile({
  category,
  isSubcategory,
  onPress,
  onLongPress,
}: {
  category: Category;
  isSubcategory?: boolean;
  onPress: () => void;
  onLongPress: (cat: Category) => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.tile, isSubcategory && styles.tileSub, animatedStyle]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      onLongPress={() => onLongPress(category)}
    >
      <CategoryIcon
        name={category.icon}
        color={category.color}
        square={isSubcategory ? 38 : 48}
        size={isSubcategory ? 16 : 20}
      />
      <Text style={styles.tileName} numberOfLines={1}>
        {isSubcategory ? `↳ ${category.name}` : category.name}
      </Text>
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
    >
      <View style={[styles.pillDot, { backgroundColor: category.color }]} />
      <Text style={styles.pillText} numberOfLines={1}>
        {category.name}
      </Text>
    </AnimatedPressable>
  );
}

/**
 * Childless categories sit in one evenly-wrapping tile grid; parents with subcategories get their own
 * full-width card below, since their child row broke the wrap into ragged lines.
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
  const leaves = topLevel.filter((c) => childrenOf(cats, c.id).length === 0);
  const parents = topLevel.filter((c) => childrenOf(cats, c.id).length > 0);

  return (
    <>
      <View style={styles.grid}>
        {leaves.map((cat) => (
          <MovingRow key={cat.id}>
            <CategoryTile category={cat} onPress={() => onEdit(cat)} onLongPress={onManage} />
          </MovingRow>
        ))}
      </View>
      {parents.map((parent) => {
        const kids = childrenOf(cats, parent.id);
        return (
          <MovingRow key={parent.id} style={styles.groupCard}>
            <GroupCardHeader
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
          </MovingRow>
        );
      })}
    </>
  );
}

function GroupCardHeader({
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
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.groupCardHeader, animatedStyle]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <CategoryIcon name={parent.icon} color={parent.color} />
      <Text style={styles.groupCardTitle}>{parent.name}</Text>
      <Text style={styles.groupCardCount}>
        {count} subcategor{count === 1 ? 'y' : 'ies'}
      </Text>
    </AnimatedPressable>
  );
}
