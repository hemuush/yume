import { View, Text, Pressable, Animated } from 'react-native';
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
  return (
    <Pressable style={styles.pill} onPress={onPress} onLongPress={onLongPress}>
      <View style={[styles.pillDot, { backgroundColor: category.color }]} />
      <Text style={styles.pillText} numberOfLines={1}>
        {category.name}
      </Text>
    </Pressable>
  );
}

/**
 * Childless categories sit in one uniform, evenly-wrapping tile grid — a
 * parent with subcategories used to sit in that same grid too, but its
 * child row broke the wrap into ragged, uneven-height lines (the "messy"
 * layout this replaced). Parents with children now get their own full-width
 * card below the grid instead, so the grid always stays a clean rectangle.
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
          <CategoryTile key={cat.id} category={cat} onPress={() => onEdit(cat)} onLongPress={onManage} />
        ))}
      </View>
      {parents.map((parent) => {
        const kids = childrenOf(cats, parent.id);
        return (
          <View key={parent.id} style={styles.groupCard}>
            <Pressable
              style={styles.groupCardHeader}
              onPress={() => onEdit(parent)}
              onLongPress={() => onManage(parent)}
            >
              <CategoryIcon name={parent.icon} color={parent.color} square={36} size={17} />
              <Text style={styles.groupCardTitle}>{parent.name}</Text>
              <Text style={styles.groupCardCount}>
                {kids.length} subcategor{kids.length === 1 ? 'y' : 'ies'}
              </Text>
            </Pressable>
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
        );
      })}
    </>
  );
}
